#!/usr/bin/env bash
# Verify public/install.sh matches scripts/install.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
npm run install:sync
if ! diff -q scripts/install.sh public/install.sh; then
  echo "install.sh out of sync with public/install.sh" >&2
  exit 1
fi
echo "install:sync check OK"
