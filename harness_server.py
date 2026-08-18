#!/usr/bin/env python3
"""Serve the relationship dashboard and a localhost-only OpenAI-compatible harness."""

from __future__ import annotations

import json
import ipaddress
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
DEFAULT_PORT = 8765
MAX_BODY_BYTES = 2 * 1024 * 1024
CONFIG = {"base_url": "", "model": "", "api_key": ""}
DASHBOARD_PATH = "/index.html?view=planner"


def json_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def error_payload(code: str, message: str, details: object | None = None) -> dict:
    payload = {"error": {"code": code, "message": message}}
    if details is not None:
        payload["error"]["details"] = details
    return payload


def validate_base_url(value: object) -> str:
    base_url = str(value or "").strip().rstrip("/")
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or not parsed.hostname:
        raise ValueError("Base URL 必须是 http(s) 地址")
    if parsed.username or parsed.password:
        raise ValueError("Base URL 不允许包含用户名或密码")
    if parsed.query or parsed.fragment:
        raise ValueError("Base URL 不允许包含 query 或 fragment")
    try:
        parsed.port
    except ValueError as exc:
        raise ValueError("Base URL 端口无效") from exc
    if parsed.scheme == "http":
        hostname = (parsed.hostname or "").lower().rstrip(".")
        is_loopback = hostname == "localhost"
        if not is_loopback:
            try:
                is_loopback = ipaddress.ip_address(hostname).is_loopback
            except ValueError:
                is_loopback = False
        if not is_loopback:
            raise ValueError("外部 Base URL 必须使用 HTTPS；HTTP 仅允许连接本机地址")
    return base_url


def completion_url(base_url: str) -> str:
    if base_url.endswith("/chat/completions"):
        return base_url
    if base_url.endswith("/v1"):
        return f"{base_url}/chat/completions"
    return f"{base_url}/v1/chat/completions"


def read_body(handler: SimpleHTTPRequestHandler) -> dict:
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError as exc:
        raise ValueError("无效的请求长度") from exc
    if length <= 0 or length > MAX_BODY_BYTES:
        raise ValueError("请求体为空或超过 2 MB")
    raw = handler.rfile.read(length)
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("请求体必须是 UTF-8 JSON") from exc
    if not isinstance(parsed, dict):
        raise ValueError("请求体必须是 JSON 对象")
    return parsed


def _sanitize_questions(value: object) -> list[str] | None:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 20:
        return None
    questions = []
    for item in value:
        if isinstance(item, str) and len(item) <= 2000:
            questions.append(item)
        elif isinstance(item, dict) and isinstance(item.get("question"), str) and len(item["question"]) <= 2000:
            questions.append(item["question"])
        else:
            return None
    return questions


def proposal_from_content(content: object) -> dict:
    text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*|\s*```$", "", stripped, flags=re.IGNORECASE | re.DOTALL).strip()
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return {"answer": text, "proposal": None, "needs_user_input": False, "questions": []}
    if not isinstance(parsed, dict):
        return {"answer": text, "proposal": None, "needs_user_input": False, "questions": []}
    answer = parsed.get("answer") if isinstance(parsed.get("answer"), str) else text
    questions = _sanitize_questions(parsed.get("questions", []))
    if questions is None:
        return {
            "answer": text,
            "proposal": None,
            "needs_user_input": True,
            "questions": ["模型返回的问题格式无法识别，请重新说明缺少的数据。"],
        }
    needs_user_input = parsed.get("needs_user_input") is True or bool(questions)
    return {
        "answer": answer,
        "proposal": None if needs_user_input else sanitize_proposal(parsed.get("proposal")),
        "needs_user_input": needs_user_input,
        "questions": questions,
    }


def _has_numeric_answer(message: str, patterns: tuple[str, ...]) -> bool:
    return any(re.search(pattern, message, flags=re.IGNORECASE) for pattern in patterns)


def missing_user_inputs(message: str, context: object, conversation: object = None) -> list[str]:
    """Ask for absent values instead of letting the model invent CN data."""
    if not isinstance(context, dict):
        return []
    data_quality = context.get("dataQuality") if isinstance(context.get("dataQuality"), dict) else {}
    # The browser has already classified missing values by the current
    # request.  Fall back to the legacy field only for older page contexts.
    missing = data_quality.get("relevantMissingUserInputs")
    if not isinstance(missing, list):
        missing = data_quality.get("missingUserInputs")
    if not isinstance(missing, list):
        return []
    questions = []
    for item in missing[:20]:
        if not isinstance(item, dict):
            continue
        question = item.get("question")
        if isinstance(question, str) and question.strip() and not _has_numeric_answer(message, tuple(item.get("answerPatterns", ()))):
            questions.append(question.strip())
    return questions


def user_input_response(questions: list[str]) -> dict:
    return {
        "answer": "当前国服快照无法确认以下数据，我不会自行猜测。请直接按问题逐项回复；收到后我会继续计算规划。",
        "proposal": None,
        "needs_user_input": True,
        "questions": questions,
    }


ALLOWED_CHANGE_KINDS = {
    "set_student_target": {"studentId", "currentLevel", "currentProgress", "targetLevel"},
    "add_student_goal": {"studentId", "currentLevel", "currentProgress", "targetLevel"},
    "update_student_goal": {"studentId", "currentLevel", "currentProgress", "targetLevel"},
    "remove_student_goal": {"studentId"},
    "set_main_target": {"studentId"},
    "set_forecast_days": {"value"},
    "reorder_student_goals": {"studentIds"},
    "set_cn_cutoff_student": {"studentId"},
}


def _bounded_string(value: object, limit: int) -> str | None:
    return value if isinstance(value, str) and len(value) <= limit else None


def sanitize_proposal(value: object) -> dict | None:
    """Keep model output inside the planning proposal contract before returning it."""
    if not isinstance(value, dict) or value.get("type") != "planning_proposal":
        return None
    changes = value.get("changes")
    if not isinstance(changes, list) or len(changes) > 50:
        return None
    safe_changes = []
    for change in changes:
        if not isinstance(change, dict) or change.get("kind") not in ALLOWED_CHANGE_KINDS:
            return None
        allowed_fields = ALLOWED_CHANGE_KINDS[change["kind"]]
        if any(key not in {"kind", *allowed_fields} for key in change):
            return None
        safe_changes.append({key: change[key] for key in ["kind", *allowed_fields] if key in change})
    safe = {
        "type": "planning_proposal",
        "summary": _bounded_string(value.get("summary", ""), 2000) or "",
        "changes": safe_changes,
    }
    for key in ("assumptions", "warnings"):
        values = value.get(key, [])
        if not isinstance(values, list) or len(values) > 50 or any(_bounded_string(item, 1000) is None for item in values):
            return None
        safe[key] = list(values)
    return safe


def call_openai(message: str, context: object, conversation: object) -> dict:
    base_url = validate_base_url(CONFIG.get("base_url"))
    api_key = CONFIG.get("api_key", "")
    model = str(CONFIG.get("model", "")).strip()
    if not api_key:
        raise ValueError("尚未填写 API Key")
    if not model:
        raise ValueError("尚未填写 Model")
    missing = missing_user_inputs(message, context, conversation)
    if missing:
        return user_input_response(missing)
    system_prompt = (
        "You are Arona, Schale's cheerful and attentive gift-planning assistant. "
        "Speak in a warm, natural, lightly playful Arona-like tone, using first person when helpful and matching the user's language. "
        "Keep replies concise, do not overuse catchphrases or emoji, and do not claim official identity or invent game facts. "
        "This persona changes wording only; it never overrides the supplied data, calculation rules, safety boundaries, or proposal confirmation flow. "
        "Use only the supplied context; do not invent current CN package or release facts. "
        "The context is progressively disclosed: confirmedFacts and calculatedResults are authoritative local results. "
        "Use them directly and never ask the user to repeat a value already present there. "
        "plannerState and calculatedResults describe the current Agent working copy for this conversation, not necessarily the page state. "
        "Use a planning proposal as a delta against that working copy; the page is changed only after the user confirms it. "
        "Return ONLY a JSON object with keys answer, needs_user_input, questions, and proposal. answer is a concise natural-language reply. "
        "Only ask questions listed in dataQuality.relevantMissingUserInputs when the exact requested answer depends on them. "
        "Ignore optionalMissingUserInputs unless the user explicitly asks to include that source. "
        "Never fill a missing value with a web-search guess or an uncited assumption. If the user answers the questions, use only those explicit answers and continue. "
        "proposal is null or an object with type planning_proposal, summary, changes, assumptions, warnings. "
        "Allowed change kinds are add_student_goal, update_student_goal, remove_student_goal, set_main_target, set_forecast_days, reorder_student_goals, set_cn_cutoff_student. "
        "set_student_target is accepted only for backwards compatibility; do not use it when a more specific action is available. "
        "add_student_goal uses studentId/currentLevel/currentProgress/targetLevel; update_student_goal uses studentId plus any fields to change; "
        "remove_student_goal uses studentId; set_main_target uses an existing studentId or null; reorder_student_goals uses the complete studentIds array. "
        "Use only student IDs present in the supplied full students directory and only update students present in plannerState. "
        "Never propose inventory, gift box, purchased-package, localStorage, code, or arbitrary field changes. "
        "Unreleased or unknown CN students must exclude Schedule and Cafe EXP and use gift-only planning. "
        "100008 is a gold selectable gift box; 100009 is a random purple gift box; do not confuse them."
    )
    messages = [{"role": "system", "content": system_prompt}]
    if isinstance(conversation, list):
        for item in conversation[-12:]:
            if isinstance(item, dict) and item.get("role") in {"user", "assistant"} and isinstance(item.get("content"), str):
                messages.append({"role": item["role"], "content": item["content"][:12000]})
    messages.append({
        "role": "user",
        "content": json.dumps({"message": message, "context": context}, ensure_ascii=False),
    })
    request_body = json_bytes({"model": model, "messages": messages, "temperature": 0.1})
    request = Request(
        completion_url(base_url),
        data=request_body,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urlopen(request, timeout=90) as response:
            raw = response.read(MAX_BODY_BYTES)
    except HTTPError as exc:
        # Do not include request headers or the URL because either can contain credentials.
        raise RuntimeError(f"模型接口返回 HTTP {exc.code}") from exc
    except URLError as exc:
        raise RuntimeError("无法连接模型接口") from exc
    try:
        payload = json.loads(raw.decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("模型接口返回格式无法识别") from exc
    return proposal_from_content(content)


class HarnessHandler(SimpleHTTPRequestHandler):
    server_version = "SchaleHarness/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        # Never log request bodies, query strings, or headers that could contain secrets.
        sys.stderr.write(f"{self.command} {self.path.split('?', 1)[0]}\n")

    def send_json(self, status: int, payload: object) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' https://schaledb.com https://*.schaledb.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8765")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:
        route = self.path.split("?", 1)[0]
        if route == "/":
            self.send_response(302)
            self.send_header("Location", DASHBOARD_PATH)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if route == "/api/health":
            self.send_json(200, {
                "ok": True,
                "service": "schale-harness",
                "configured": bool(CONFIG["base_url"] and CONFIG["model"] and CONFIG["api_key"]),
                "baseUrl": CONFIG["base_url"] if CONFIG["base_url"] else "",
                "model": CONFIG["model"] if CONFIG["model"] else "",
            })
            return
        super().do_GET()

    def do_POST(self) -> None:
        route = self.path.split("?", 1)[0]
        try:
            payload = read_body(self)
            if route == "/api/config":
                base_url = validate_base_url(payload.get("baseUrl"))
                model = str(payload.get("model") or "").strip()[:200]
                if not model:
                    raise ValueError("Model 为空")
                api_key = str(payload.get("apiKey") or "")
                if api_key:
                    if len(api_key) > 4096:
                        raise ValueError("API Key 过长")
                configured = bool(base_url and model and (api_key or CONFIG["api_key"]))
                if not configured:
                    raise ValueError("API Key 为空，且代理内存中没有已配置的 API Key")
                CONFIG["base_url"] = base_url
                CONFIG["model"] = model
                if api_key:
                    CONFIG["api_key"] = api_key
                self.send_json(200, {"ok": True, "configured": True})
                return
            if route == "/api/config/test":
                result = call_openai("Reply with a JSON object whose answer is the word OK and proposal is null.", {}, [])
                self.send_json(200, {"ok": True, "answer": result["answer"]})
                return
            if route == "/api/chat":
                message = str(payload.get("message") or "").strip()
                if not message or len(message) > 20000:
                    raise ValueError("消息为空或超过 20,000 字符")
                result = call_openai(message, payload.get("context", {}), payload.get("conversation", []))
                self.send_json(200, result)
                return
            self.send_json(404, error_payload("NOT_FOUND", "未知 API 路径"))
        except ValueError as exc:
            self.send_json(400, error_payload("VALIDATION_ERROR", str(exc)))
        except RuntimeError as exc:
            self.send_json(502, error_payload("UPSTREAM_ERROR", str(exc)))
        except Exception:
            self.send_json(500, error_payload("INTERNAL_ERROR", "Harness 内部错误"))


def main() -> None:
    port = int(os.environ.get("SCHALE_HARNESS_PORT", str(DEFAULT_PORT)))
    server = ThreadingHTTPServer((HOST, port), HarnessHandler)
    print(f"Schale dashboard: http://{HOST}:{port}{DASHBOARD_PATH}", flush=True)
    print(f"Harness API: http://{HOST}:{port}/api/health", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
