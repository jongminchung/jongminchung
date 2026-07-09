#!/bin/sh
set -eu

MLX_PORT=${MLX_PORT:-8000}
MLX_PID_FILE=${MLX_PID_FILE:-.output/mlx-server.pid}
MLX_LOG_FILE=${MLX_LOG_FILE:-.output/mlx-server.log}
MLX_SCREEN_SESSION=${MLX_SCREEN_SESSION:-immersive-translate-mlx}

mkdir -p "$(dirname "$MLX_PID_FILE")" "$(dirname "$MLX_LOG_FILE")"

if [ -s "$MLX_PID_FILE" ]; then
  existing_ref=$(cat "$MLX_PID_FILE")
  case "$existing_ref" in
    screen:*)
      existing_session=${existing_ref#screen:}
      if command -v screen >/dev/null 2>&1 && screen -ls | grep -q "[.]$existing_session[[:space:]]"; then
        echo "mlx-lm server is already running in screen session $existing_session"
        echo "log: $MLX_LOG_FILE"
        exit 0
      fi
      ;;
    *)
      if [ -n "$existing_ref" ] && kill -0 "$existing_ref" 2>/dev/null; then
        echo "mlx-lm server is already running with pid $existing_ref"
        echo "log: $MLX_LOG_FILE"
        exit 0
      fi
      ;;
  esac
fi

if command -v screen >/dev/null 2>&1; then
  if screen -ls | grep -q "[.]$MLX_SCREEN_SESSION[[:space:]]"; then
    echo "mlx-lm server is already running in screen session $MLX_SCREEN_SESSION"
    echo "log: $MLX_LOG_FILE"
    exit 0
  fi
fi

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$MLX_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  for listener_pid in $(lsof -nP -iTCP:"$MLX_PORT" -sTCP:LISTEN -t 2>/dev/null); do
    listener_command=$(ps -p "$listener_pid" -o command= 2>/dev/null || true)
    case "$listener_command" in
      *mlx_lm.server*)
        echo "$listener_pid" > "$MLX_PID_FILE"
        echo "mlx-lm server is already listening on port $MLX_PORT with pid $listener_pid"
        echo "log: $MLX_LOG_FILE"
        echo "health: curl http://127.0.0.1:$MLX_PORT/v1/models"
        exit 0
        ;;
    esac
  done
  echo "port $MLX_PORT is already listening, but it is not an mlx-lm server; not starting another mlx-lm server" >&2
  exit 1
fi

if command -v screen >/dev/null 2>&1; then
  screen -dmS "$MLX_SCREEN_SESSION" sh -c "cd '$PWD' && exec sh scripts/run-mlx-server.sh >> '$MLX_LOG_FILE' 2>&1"
  echo "screen:$MLX_SCREEN_SESSION" > "$MLX_PID_FILE"
  echo "started mlx-lm server in screen session $MLX_SCREEN_SESSION"
  echo "log: $MLX_LOG_FILE"
  echo "health: curl http://127.0.0.1:$MLX_PORT/v1/models"
  exit 0
fi

nohup sh scripts/run-mlx-server.sh > "$MLX_LOG_FILE" 2>&1 &
pid=$!
echo "$pid" > "$MLX_PID_FILE"

echo "started mlx-lm server with pid $pid"
echo "log: $MLX_LOG_FILE"
echo "health: curl http://127.0.0.1:$MLX_PORT/v1/models"
