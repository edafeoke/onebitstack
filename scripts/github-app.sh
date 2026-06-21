#!/usr/bin/env bash
# GitHub App VPS setup helpers (self-host).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

load_env() {
  if [[ ! -f .env ]]; then return; fi
  local v
  v=$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- || true)
  [[ -n "$v" ]] && export DATABASE_URL="$v"
  v=$(grep -E '^GITHUB_APP_ID=' .env 2>/dev/null | head -1 | cut -d= -f2- || true)
  [[ -n "$v" ]] && export GITHUB_APP_ID="$v"
  # Export remaining GITHUB_* / APP vars via Node (handles quoted values and PEM).
  if command -v node >/dev/null && [[ -f package.json ]]; then
    eval "$(node --import dotenv/config -e "
      const keys=Object.keys(process.env).filter(k=>k.startsWith('GITHUB_')||k==='APP_NAME');
      for (const k of keys) console.log('export '+k+'='+JSON.stringify(process.env[k]||''));
    " 2>/dev/null)" || true
  fi
}

cmd="${1:-help}"
shift || true

case "$cmd" in
  urls)
    load_env
    node --import tsx -e "
      const { getGithubAppSetupStatus } = await import('./src/lib/github-app/setup.ts');
      const s = getGithubAppSetupStatus();
      console.log('Webhook:      POST', s.publicUrls.webhook);
      console.log('OAuth:       ', s.publicUrls.oauthCallback);
      console.log('Manifest cb: ', s.publicUrls.manifestRedirect);
    "
    ;;
  secret)
    openssl rand -hex 32
    ;;
  manifest)
    load_env
    node --import tsx -e "
      const { buildGithubAppManifest, resolvePublicBaseUrl } = await import('./src/lib/github-app/setup.ts');
      const base = resolvePublicBaseUrl();
      const m = buildGithubAppManifest(base);
      console.log('Base URL:', base);
      console.log('');
      console.log('Manifest JSON (for reference):');
      console.log(JSON.stringify(m, null, 2));
      console.log('');
      console.log('In the running app, open:');
      console.log(base + '/api/setup/github/manifest');
      console.log('Or POST the manifest to https://github.com/settings/apps/new');
    "
    ;;
  verify)
    load_env
    npx tsx scripts/github-app-verify.ts
    ;;
  apply)
    load_env
    ENV_FILE="${ROOT}/.env"
    if [[ ! -f "$ENV_FILE" ]]; then
      touch "$ENV_FILE"
    fi
    cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"
    echo "Backed up .env — paste GitHub App lines (end with empty line or Ctrl-D):"
    block=""
    while IFS= read -r line; do
      [[ -z "$line" ]] && break
      block+="$line"$'\n'
    done
    if [[ -z "$block" ]]; then
      echo "No input." >&2
      exit 1
    fi
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      key="${line%%=*}"
      val="${line#*=}"
      if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        if [[ "$(uname)" == Darwin ]]; then
          sed -i '' "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
        else
          sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
        fi
      else
        echo "${key}=${val}" >> "$ENV_FILE"
      fi
    done <<< "$block"
    echo "Updated .env — restart the app, then run: central-cli github-app verify"
    ;;
  help|-h|--help)
    cat <<'EOF'
Usage: central-cli github-app <command>

  urls       Print webhook and OAuth URLs for this instance
  secret     Generate a webhook secret (hex)
  manifest   Print manifest JSON and setup URL hints
  verify     Verify GITHUB_* credentials in .env
  apply      Interactively merge env lines into .env (creates backup)
EOF
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    exit 1
    ;;
esac
