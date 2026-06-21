#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Stopping services…"
systemctl stop central-deploy-worker central-server 2>/dev/null || true
command -v pm2 >/dev/null && pm2 delete central-deploy-worker central-server 2>/dev/null || true

read -r -p "Remove install directory $ROOT? [y/N]: " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
  parent=$(dirname "$ROOT")
  base=$(basename "$ROOT")
  cd "$parent"
  rm -rf "$base"
  echo "Removed $ROOT"
else
  echo "Services stopped. Data kept at $ROOT"
fi

rm -f /usr/local/bin/central-cli 2>/dev/null || true
