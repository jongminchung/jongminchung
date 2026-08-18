#!/bin/bash
#
# Delete every GitHub Packages version that matches a requested package version.

set -o errexit
set -o nounset
set -o pipefail

#######################################
# Delete matching npm package versions owned by a GitHub user or organization.
# Globals:
#   GH_TOKEN
# Arguments:
#   $1: GitHub package owner.
#   $2: Unscoped npm package name.
#   $3: Package version to delete.
#######################################
function main() {
  if [[ $# -ne 3 ]]; then
    printf 'Usage: %s OWNER PACKAGE_NAME VERSION\n' "$0" >&2
    return 1
  fi

  local owner="$1"
  local package_name="$2"
  local package_version="$3"
  local version_ids

  if ! version_ids="$(
    gh api --paginate \
      "/users/${owner}/packages/npm/${package_name}/versions" \
      --jq ".[] | select(.name == \"${package_version}\") | .id" 2>&1
  )"; then
    if [[ "${version_ids}" == *'HTTP 404'* ]]; then
      printf 'No package version %s for %s; skipping deletion.\n' \
        "${package_version}" "${package_name}"
      return 0
    fi
    printf '%s\n' "${version_ids}" >&2
    return 1
  fi

  if [[ -z "${version_ids}" ]]; then
    printf 'No package version %s for %s; skipping deletion.\n' \
      "${package_version}" "${package_name}"
    return 0
  fi

  local version_id
  while IFS= read -r version_id; do
    if [[ -n "${version_id}" ]]; then
      gh api --method DELETE \
        "/users/${owner}/packages/npm/${package_name}/versions/${version_id}"
    fi
  done <<< "${version_ids}"
}

main "$@"
