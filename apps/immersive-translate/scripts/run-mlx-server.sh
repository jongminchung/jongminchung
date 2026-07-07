#!/bin/sh
set -eu

MLX_MODEL=${MLX_MODEL:-mlx-community/Qwen3-1.7B-4bit}
MLX_HOST=${MLX_HOST:-0.0.0.0}
MLX_PORT=${MLX_PORT:-8000}
CA_BUNDLE=${REQUESTS_CA_BUNDLE:-.output/macos-ca-bundle.pem}
UVX=${UVX:-}

if [ -z "$UVX" ]; then
  for candidate in \
    "$HOME/.local/share/mise/installs/uv/latest/uv-aarch64-apple-darwin/uvx" \
    "$HOME/.local/bin/uvx" \
    uvx; do
    if command -v "$candidate" >/dev/null 2>&1; then
      UVX=$candidate
      break
    fi
  done
fi

if [ -z "$UVX" ]; then
  echo "uvx was not found. Install uv with mise or set UVX." >&2
  exit 1
fi

if [ ! -s "$CA_BUNDLE" ] && command -v security >/dev/null 2>&1; then
  mkdir -p "$(dirname "$CA_BUNDLE")"
  security find-certificate -a -p /Library/Keychains/System.keychain > "$CA_BUNDLE"
  security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain >> "$CA_BUNDLE"
fi

export REQUESTS_CA_BUNDLE="$CA_BUNDLE"
export CURL_CA_BUNDLE="$CA_BUNDLE"
export UV_SYSTEM_CERTS=${UV_SYSTEM_CERTS:-1}

exec "$UVX" \
  --from "mlx-lm==0.29.1" \
  --with "transformers<5" \
  --with "mlx<0.31.2" \
  --with "mlx-metal<0.31.2" \
  mlx_lm.server \
  --model "$MLX_MODEL" \
  --host "$MLX_HOST" \
  --port "$MLX_PORT"
