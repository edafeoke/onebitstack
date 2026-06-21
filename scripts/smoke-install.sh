#!/usr/bin/env bash
# Non-interactive smoke test for install.sh (SQLite, no clone).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_DIR="${SMOKE_DIR:-/tmp/central-smoke-$$}"

cleanup() {
  rm -rf "$SMOKE_DIR"
}
trap cleanup EXIT

mkdir -p "$SMOKE_DIR"
tar -C "$ROOT" \
  --exclude=.git \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=data \
  --exclude=.env \
  -cf - . | tar -C "$SMOKE_DIR" -xf -

bash "$SMOKE_DIR/scripts/install.sh" \
  --dir "$SMOKE_DIR" \
  --no-clone \
  --no-interactive \
  --no-systemd \
  --database sqlite \
  --sqlite-path ./data/smoke.db \
  --url http://127.0.0.1:3999

grep -q 'CENTRAL_EDITION=control_plane' "$SMOKE_DIR/.env"
grep -q 'BETTER_AUTH_SECRET=' "$SMOKE_DIR/.env"
grep -q 'ENCRYPTION_KEY=' "$SMOKE_DIR/.env"
test -d "$SMOKE_DIR/.next"

echo "smoke-install: OK"
