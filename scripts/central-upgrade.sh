#!/usr/bin/env bash
# Upgrade existing install: pull, migrate, build, restart.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Upgrading Central Server at $ROOT…"
[[ -d .git ]] && git pull --ff-only

if [[ -f package-lock.json ]]; then npm ci; else npm install; fi

provider=$(grep -E '^CENTRAL_DATABASE_PROVIDER=' .env 2>/dev/null | cut -d= -f2- || echo postgresql)
if [[ "$provider" == sqlite ]]; then
  npx prisma db push
else
  npx prisma migrate deploy || npm run db:bootstrap 2>/dev/null || true
fi

npm run build

if systemctl is-active --quiet central-server 2>/dev/null; then
  systemctl restart central-server central-deploy-worker
  echo "Restarted systemd services"
elif command -v pm2 >/dev/null; then
  npm run pm2:restart 2>/dev/null || npm run pm2:start
  echo "Restarted PM2"
else
  echo "Restart manually: npm start && npm run worker:deploy"
fi

bash "$ROOT/scripts/central-doctor.sh" || true
