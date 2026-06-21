#!/usr/bin/env bash
# Shared helpers for central-cli subcommands.
set -euo pipefail

central_root() {
  local dir
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  printf '%s' "$dir"
}

central_load_env() {
  local root
  root="$(central_root)"
  cd "$root"
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source <(grep -E '^[A-Z_][A-Z0-9_]*=' .env | sed 's/^/export /')
    set +a
  fi
}

central_env_get() {
  local key="$1"
  [[ -f .env ]] || return 1
  grep -E "^${key}=" .env 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//'
}

central_rand_secret() {
  if command -v openssl >/dev/null; then
    openssl rand -base64 32 | tr -d '\n'
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n'
  fi
}
