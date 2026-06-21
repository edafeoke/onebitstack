#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=central-lib.sh
source "$ROOT/scripts/central-lib.sh"
cd "$ROOT"

if [[ -f .env ]]; then
  echo ".env already exists at $ROOT/.env — aborting" >&2
  exit 1
fi

if [[ -f .env.production.example ]]; then
  cp .env.production.example .env
else
  cp .env.example .env 2>/dev/null || true
fi

auth=$(central_rand_secret)
enc=$(central_rand_secret)
grep -q '^BETTER_AUTH_SECRET=' .env && sed -i.bak "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${auth}|" .env || echo "BETTER_AUTH_SECRET=${auth}" >> .env
grep -q '^ENCRYPTION_KEY=' .env && sed -i.bak "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${enc}|" .env || echo "ENCRYPTION_KEY=${enc}" >> .env
rm -f .env.bak

grep -q '^CENTRAL_EDITION=' .env || echo "CENTRAL_EDITION=control_plane" >> .env
grep -q '^DEPLOYMENT_MODE=' .env || echo "DEPLOYMENT_MODE=self_hosted" >> .env
grep -q '^ENABLE_CREDENTIAL_AUTH=' .env || echo "ENABLE_CREDENTIAL_AUTH=true" >> .env

echo "Created .env with generated secrets."
echo "Edit DATABASE_URL, NEXT_PUBLIC_APP_URL, then run: central-cli install --no-clone"
