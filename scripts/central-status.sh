#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=central-lib.sh
source "$ROOT/scripts/central-lib.sh"
cd "$ROOT"
central_load_env

echo "Central Server status"
echo "  Install dir: $ROOT"
echo "  Edition:     $(central_env_get CENTRAL_EDITION || echo control_plane)"
echo "  Mode:        $(central_env_get DEPLOYMENT_MODE || echo self_hosted)"
echo "  Public URL:  $(central_env_get NEXT_PUBLIC_APP_URL || echo —)"
echo "  Database:    $(central_env_get CENTRAL_DATABASE_PROVIDER || echo postgresql)"

if systemctl is-active --quiet central-server 2>/dev/null; then
  echo "  App:         running (systemd)"
elif command -v pm2 >/dev/null && pm2 describe central-server >/dev/null 2>&1; then
  echo "  App:         running (pm2)"
else
  echo "  App:         not detected"
fi

if systemctl is-active --quiet central-deploy-worker 2>/dev/null; then
  echo "  Worker:      running (systemd)"
elif command -v pm2 >/dev/null && pm2 describe central-deploy-worker >/dev/null 2>&1; then
  echo "  Worker:      running (pm2)"
else
  echo "  Worker:      not detected"
fi

if command -v curl >/dev/null; then
  origin=$(central_env_get NEXT_PUBLIC_APP_URL || echo http://127.0.0.1:3000)
  code=$(curl -fsS -o /dev/null -w "%{http_code}" "${origin%/}/api/setup/status" 2>/dev/null || echo "000")
  echo "  API:         HTTP $code (${origin%/}/api/setup/status)"
fi
