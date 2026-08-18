import json
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from http.client import HTTPConnection
from threading import Thread

import harness_server


class HarnessContractTests(unittest.TestCase):
    def setUp(self):
        harness_server.CONFIG.update({"base_url": "", "model": "", "api_key": ""})

    def test_completion_url_accepts_common_base_url_forms(self):
        self.assertEqual(
            harness_server.completion_url("https://example.test"),
            "https://example.test/v1/chat/completions",
        )
        self.assertEqual(
            harness_server.completion_url("https://example.test/v1"),
            "https://example.test/v1/chat/completions",
        )
        self.assertEqual(
            harness_server.completion_url("https://example.test/v1/chat/completions"),
            "https://example.test/v1/chat/completions",
        )

    def test_base_url_rejects_credentials_query_and_fragment(self):
        for value in (
            "ftp://example.test",
            "https://user:pass@example.test",
            "https://example.test?token=secret",
            "https://example.test#fragment",
            "http://model.example.test",
        ):
            with self.assertRaises(ValueError):
                harness_server.validate_base_url(value)

    def test_base_url_allows_https_and_loopback_http(self):
        self.assertEqual(harness_server.validate_base_url("https://model.example.test"), "https://model.example.test")
        self.assertEqual(harness_server.validate_base_url("http://127.0.0.1:1234"), "http://127.0.0.1:1234")
        self.assertEqual(harness_server.validate_base_url("http://[::1]:1234"), "http://[::1]:1234")
        self.assertEqual(harness_server.validate_base_url("http://localhost:1234"), "http://localhost:1234")

    def test_proposal_sanitizer_drops_untrusted_shape(self):
        proposal = harness_server.sanitize_proposal({
            "type": "planning_proposal",
            "summary": "计划",
            "changes": [{"kind": "set_forecast_days", "value": 60}],
            "assumptions": ["只按快照"],
            "warnings": [],
        })
        self.assertEqual(proposal["changes"], [{"kind": "set_forecast_days", "value": 60}])
        self.assertIsNone(harness_server.sanitize_proposal({
            "type": "planning_proposal",
            "changes": [{"kind": "set_forecast_days", "value": 60, "inventory": {}}],
        }))

    def test_model_questions_disable_proposal(self):
        result = harness_server.proposal_from_content(json.dumps({
            "answer": "需要补充数据",
            "needs_user_input": True,
            "questions": ["每天咖啡厅摸头几次？"],
            "proposal": {
                "type": "planning_proposal",
                "summary": "不应应用",
                "changes": [{"kind": "set_forecast_days", "value": 60}],
            },
        }))
        self.assertTrue(result["needs_user_input"])
        self.assertEqual(result["questions"], ["每天咖啡厅摸头几次？"])
        self.assertIsNone(result["proposal"])

    def test_missing_context_returns_user_questions(self):
        context = {
            "dataQuality": {
                "missingUserInputs": [{
                    "question": "每天咖啡厅摸头次数是多少？",
                    "answerPatterns": [r"咖啡厅.{0,12}\d+"],
                }],
            },
        }
        questions = harness_server.missing_user_inputs("请规划未来两个月", context, [])
        self.assertEqual(questions, ["每天咖啡厅摸头次数是多少？"])
        self.assertEqual(harness_server.missing_user_inputs("咖啡厅每天8次", context, []), [])

    def test_partial_user_answer_keeps_unanswered_questions(self):
        context = {
            "dataQuality": {
                "missingUserInputs": [
                    {"question": "日程次数？", "answerPatterns": [r"日程.{0,12}\d+"]},
                    {"question": "咖啡厅次数？", "answerPatterns": [r"咖啡厅.{0,12}\d+"]},
                ],
            },
        }
        self.assertEqual(
            harness_server.missing_user_inputs("日程每天1次", context, []),
            ["咖啡厅次数？"],
        )

    def test_progressive_context_uses_relevant_missing_inputs_first(self):
        context = {
            "dataQuality": {
                "relevantMissingUserInputs": [{
                    "question": "当前请求需要的日程次数？",
                    "answerPatterns": [r"日程.{0,12}\d+"],
                }],
                "missingUserInputs": [{
                    "question": "旧版上下文中的咖啡厅次数？",
                    "answerPatterns": [r"咖啡厅.{0,12}\d+"],
                }],
            },
        }
        self.assertEqual(
            harness_server.missing_user_inputs("请规划", context, []),
            ["当前请求需要的日程次数？"],
        )

    def test_health_exposes_reuse_metadata_without_api_key(self):
        harness_server.CONFIG.update({
            "base_url": "https://api.example.test",
            "model": "deepseek-v4-flash",
            "api_key": "secret-that-must-not-be-returned",
        })
        server = ThreadingHTTPServer(("127.0.0.1", 0), harness_server.HarnessHandler)
        thread = Thread(target=server.handle_request, daemon=True)
        thread.start()
        connection = HTTPConnection("127.0.0.1", server.server_address[1], timeout=2)
        connection.request("GET", "/api/health")
        response = connection.getresponse()
        body = json.loads(response.read())
        connection.close()
        server.server_close()
        self.assertEqual(body["baseUrl"], "https://api.example.test")
        self.assertEqual(body["model"], "deepseek-v4-flash")
        self.assertNotIn("apiKey", body)

    def test_call_openai_forwards_progressive_context_and_sanitizes_response(self):
        received = {}

        class FakeModelHandler(SimpleHTTPRequestHandler):
            def do_POST(self):
                received["authorization"] = self.headers.get("Authorization")
                length = int(self.headers.get("Content-Length", "0"))
                received["body"] = json.loads(self.rfile.read(length))
                content = json.dumps({
                    "answer": "直接使用本地计算结果",
                    "needs_user_input": False,
                    "questions": [],
                    "proposal": {
                        "type": "planning_proposal",
                        "summary": "调整周期",
                        "changes": [{"kind": "set_forecast_days", "value": 60}],
                        "assumptions": [],
                        "warnings": [],
                    },
                }, ensure_ascii=False)
                payload = json.dumps({"choices": [{"message": {"content": content}}]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, format, *args):
                pass

        upstream = ThreadingHTTPServer(("127.0.0.1", 0), FakeModelHandler)
        thread = Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        try:
            harness_server.CONFIG.update({
                "base_url": f"http://127.0.0.1:{upstream.server_address[1]}",
                "model": "fake-model",
                "api_key": "test-key-that-must-not-leak",
            })
            result = harness_server.call_openai(
                "请给出规划",
                {
                    "schemaVersion": 2,
                    "confirmedFacts": {"plannedStudents": [{"studentId": 10122}]},
                    "calculatedResults": {"giftPlanning": {"projections": [{"studentId": 10122, "combined": {"gap": 123.45}}]}},
                    "dataQuality": {"relevantMissingUserInputs": []},
                },
                [],
            )
        finally:
            upstream.shutdown()
            upstream.server_close()
        self.assertEqual(result["answer"], "直接使用本地计算结果")
        self.assertEqual(result["proposal"]["changes"], [{"kind": "set_forecast_days", "value": 60}])
        self.assertEqual(received["authorization"], "Bearer test-key-that-must-not-leak")
        request_text = json.dumps(received["body"], ensure_ascii=False)
        self.assertIn("confirmedFacts", request_text)
        self.assertIn("calculatedResults", request_text)
        self.assertNotIn("test-key-that-must-not-leak", request_text)

    def test_call_openai_asks_relevant_missing_input_before_upstream(self):
        harness_server.CONFIG.update({
            "base_url": "http://127.0.0.1:1",
            "model": "fake-model",
            "api_key": "test-key",
        })
        result = harness_server.call_openai(
            "只按礼物规划",
            {"dataQuality": {"relevantMissingUserInputs": [{
                "question": "需要的日程次数？",
                "answerPatterns": [r"日程.{0,12}\d+"],
            }]}},
            [],
        )
        self.assertTrue(result["needs_user_input"])
        self.assertEqual(result["questions"], ["需要的日程次数？"])
        self.assertIsNone(result["proposal"])

    def test_root_redirects_to_planner_page(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), harness_server.HarnessHandler)
        thread = Thread(target=server.handle_request, daemon=True)
        thread.start()
        connection = HTTPConnection("127.0.0.1", server.server_address[1], timeout=2)
        connection.request("GET", "/")
        response = connection.getresponse()
        self.assertEqual(response.status, 302)
        self.assertEqual(response.getheader("Location"), harness_server.DASHBOARD_PATH)
        connection.close()
        server.server_close()


if __name__ == "__main__":
    unittest.main()
