#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd -- "${script_dir}/.." && pwd)"
lychee_image="${LYCHEE_IMAGE:-lycheeverse/lychee:0.24.2}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the link checker" >&2
  exit 1
fi

docker run --init --rm \
  --volume "${repository_root}:/workspace:ro" \
  --workdir /workspace \
  "${lychee_image}" \
  --offline \
  --no-progress \
  --include-fragments=anchor-only \
  --extensions md,html \
  .
