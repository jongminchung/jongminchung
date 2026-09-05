#!/usr/bin/env bash
# Use Git's source list so dependencies, generated output and deleted files stay out.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

mode=${1:?Usage: style-shell.sh write|check|syntax|lint}
case "$mode" in
write | check | syntax | lint) ;;
*)
  printf 'Unknown shell check mode: %s\n' "$mode" >&2
  exit 2
  ;;
esac

files=()
while IFS= read -r -d '' file; do
  case "/$file" in
  */node_modules/* | */.obsidian/* | */3_Resource/* | */vendor/* | */.venv/* | */venv/* | */dist/* | */build/*) continue ;;
  esac
  [[ -f "$file" ]] && files+=("$file")
done < <(git ls-files --cached --others --exclude-standard -z -- '*.sh' | sort -zu)
((${#files[@]})) || exit 0

case "$mode" in
# Do not pass indentation or language flags: shfmt reads .editorconfig and shebangs.
write) "${SHFMT_BIN:-shfmt}" -w "${files[@]}" ;;
check) "${SHFMT_BIN:-shfmt}" -d "${files[@]}" ;;
lint) "${SHELLCHECK_BIN:-shellcheck}" --severity="${SHELLCHECK_SEVERITY:-style}" "${files[@]}" ;;
syntax)
  for file in "${files[@]}"; do
    IFS= read -r first_line <"$file" || true
    case "$first_line" in
    *bash*) bash -n "$file" ;;
    *) sh -n "$file" ;;
    esac
  done
  printf '%s\n' 'PASS shell syntax checks'
  ;;
esac
