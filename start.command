#!/bin/zsh

set -u

PROJECT_DIR="${0:A:h}"
PORT="${SCHALE_HARNESS_PORT:-8765}"
URL="http://127.0.0.1:${PORT}/index.html?view=planner"
LOG_FILE="${TMPDIR:-/tmp}/schale-alchemy-workshop-${PORT}.log"

cd "$PROJECT_DIR" || exit 1

if ! /usr/bin/curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  nohup /usr/bin/python3 harness_server.py >"$LOG_FILE" 2>&1 &
  server_pid=$!
  ready=0
  for _ in {1..30}; do
    if /usr/bin/curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
      ready=1
      break
    fi
    /bin/sleep 0.2
  done
  if (( ! ready )); then
    echo "礼物工坊启动失败，日志：$LOG_FILE"
    kill "$server_pid" 2>/dev/null || true
    exit 1
  fi
fi

/usr/bin/open "$URL"
echo "礼物工坊已打开：$URL"
