#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=central-lib.sh
source "$ROOT/scripts/central-lib.sh"
cd "$ROOT"
central_load_env

echo "=== Central Server doctor ==="
ok=0
warn=0

check() {
  local label="$1" status="$2" msg="${3:-}"
  if [[ "$status" == ok ]]; then
    echo "  [ok] $label"
    ok=$((ok + 1))
  else
    echo "  [!!] $label${msg:+ — $msg}"
    warn=$((warn + 1))
  fi
}

if command -v node >/dev/null; then
  major=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
  if [[ "$major" -ge 20 ]]; then check "Node.js $(node -v)" ok; else check "Node.js $(node -v)" fail "need 20+"; fi
else
  check "Node.js" fail "not installed"
fi

command -v docker >/dev/null && check "Docker" ok || check "Docker" fail "optional for bundled DB"

[[ -f .env ]] && check ".env file" ok || check ".env file" fail "missing"

edition=$(central_env_get CENTRAL_EDITION || echo control_plane)
check "Edition: ${edition:-control_plane}" ok

if [[ -n "$(central_env_get DATABASE_URL || true)" ]]; then
  npm run db:verify >/dev/null 2>&1 && check "Database" ok || check "Database" fail "db:verify failed"
else
  check "DATABASE_URL" fail "unset"
fi

if [[ -n "$(central_env_get REDIS_URL || true)" ]]; then
  if command -v redis-cli >/dev/null; then
    redis-cli -u "$(central_env_get REDIS_URL)" ping >/dev/null 2>&1 && check "Redis" ok || check "Redis" fail "ping failed"
  else
    check "REDIS_URL set" ok
  fi
else
  check "REDIS_URL" fail "required in production"
fi

[[ -n "$(central_env_get BETTER_AUTH_SECRET || true)" ]] && check "BETTER_AUTH_SECRET" ok || check "BETTER_AUTH_SECRET" fail
[[ -n "$(central_env_get ENCRYPTION_KEY || true)" ]] && check "ENCRYPTION_KEY" ok || check "ENCRYPTION_KEY" fail

if [[ -n "$(central_env_get GITHUB_APP_ID || true)" && -n "$(central_env_get GITHUB_PRIVATE_KEY || true)" ]]; then
  bash "$ROOT/scripts/github-app.sh" verify >/dev/null 2>&1 && check "GitHub App" ok || check "GitHub App" fail "verify failed"
else
  check "GitHub App" fail "not configured — complete /setup"
fi

if systemctl is-active --quiet central-server 2>/dev/null; then
  check "central-server (systemd)" ok
elif command -v pm2 >/dev/null && pm2 describe central-server >/dev/null 2>&1; then
  check "central-server (pm2)" ok
else
  check "App process" fail "not running — systemctl start central-server or npm start"
fi

if systemctl is-active --quiet central-deploy-worker 2>/dev/null; then
  check "deploy worker (systemd)" ok
elif command -v pm2 >/dev/null && pm2 describe central-deploy-worker >/dev/null 2>&1; then
  check "deploy worker (pm2)" ok
else
  check "Deploy worker" fail "not running — npm run worker:deploy"
fi

origin=$(central_env_get NEXT_PUBLIC_APP_URL || echo "")
[[ -n "$origin" && "$origin" != "http://localhost:3000" ]] && check "Public URL: $origin" ok || check "Public URL" fail "set NEXT_PUBLIC_APP_URL"

echo ""
echo "Checks passed: $ok | issues: $warn"
[[ $warn -eq 0 ]]
