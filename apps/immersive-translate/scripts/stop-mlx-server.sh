#!/bin/sh
set -eu

MLX_PID_FILE=${MLX_PID_FILE:-.output/mlx-server.pid}

if [ ! -s "$MLX_PID_FILE" ]; then
  echo "no mlx-lm pid file found"
  exit 0
fi

ref=$(cat "$MLX_PID_FILE")
if [ -z "$ref" ]; then
  rm -f "$MLX_PID_FILE"
  echo "removed empty mlx-lm pid file"
  exit 0
fi

case "$ref" in
  screen:*)
    session=${ref#screen:}
    if command -v screen >/dev/null 2>&1 && screen -ls | grep -q "[.]$session[[:space:]]"; then
      screen -S "$session" -X quit
      echo "stopped mlx-lm screen session $session"
    else
      echo "mlx-lm screen session $session is not running"
    fi
    ;;
  *)
    if kill -0 "$ref" 2>/dev/null; then
      kill "$ref"
      echo "stopped mlx-lm server pid $ref"
    else
      echo "mlx-lm server pid $ref is not running"
    fi
    ;;
esac

rm -f "$MLX_PID_FILE"
