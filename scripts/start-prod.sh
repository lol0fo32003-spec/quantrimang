#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"

mkdir -p "$RUN_DIR" "$LOG_DIR"

stop_if_running() {
  local name="$1"
  local pid_file="$RUN_DIR/$name.pid"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "Stopping existing $name process: $pid"
      kill "$pid"
      for _ in {1..20}; do
        if ! kill -0 "$pid" 2>/dev/null; then
          break
        fi
        sleep 0.2
      done
    fi
    rm -f "$pid_file"
  fi
}

start_backend() {
  echo "Starting backend on port ${PORT:-4000}"
  (
    cd "$ROOT_DIR/server"
    nohup npm run start >"$LOG_DIR/backend.log" 2>&1 &
    echo $! >"$RUN_DIR/backend.pid"
  )
}

start_frontend() {
  echo "Building frontend"
  npm run build --workspace client

  echo "Starting frontend preview on port ${FRONTEND_PORT:-4173}"
  (
    cd "$ROOT_DIR/client"
    nohup npm run preview -- --host 0.0.0.0 --port "${FRONTEND_PORT:-4173}" >"$LOG_DIR/frontend.log" 2>&1 &
    echo $! >"$RUN_DIR/frontend.pid"
  )
}

stop_if_running backend
stop_if_running frontend
start_backend
start_frontend

echo
echo "Production services started:"
echo "  Backend:  http://localhost:${PORT:-4000}"
echo "  Frontend: http://localhost:${FRONTEND_PORT:-4173}"
echo
echo "Logs:"
echo "  tail -f $LOG_DIR/backend.log"
echo "  tail -f $LOG_DIR/frontend.log"
