#!/usr/bin/env bash
# Central Server installer — curl-friendly, upgrade-by-default.
set -euo pipefail

REPO_URL="${CENTRAL_REPO_URL:-https://github.com/centralstack/central-server.git}"
INSTALL_DIR="${CENTRAL_INSTALL_DIR:-$HOME/central-server}"
DATABASE_TYPE=""
POSTGRES_MODE=""
SQLITE_PATH="${CENTRAL_SQLITE_PATH:-./data/central.db}"
PUBLIC_DOMAIN=""
PUBLIC_URL=""
FRESH=0
INTERACTIVE=1
NO_CLONE=0
USE_SYSTEMD=""
FRESH_ENV=0

usage() {
  cat <<'EOF'
Central Server installer (control plane)

  --dir PATH              Install directory (default: ~/central-server)
  --fresh                 Remove existing install and clone fresh (destructive)
  --no-clone              Use --dir as an existing checkout (no git clone/pull)
  --no-interactive        Non-interactive mode
  --database TYPE         postgresql | sqlite (default: postgresql)
  --postgres MODE         docker | external | skip (postgresql delivery)
  --sqlite-path PATH      SQLite file path (default: ./data/central.db)
  --domain HOST           Public hostname (sets HTTPS URLs in .env)
  --url URL               Public origin (overrides --domain)
  --systemd               Install systemd units (default when root + systemd)
  --no-systemd            Skip systemd unit install
  --repo URL              Git URL to clone
  -h, --help              Show help

Environment:
  CENTRAL_REPO_URL        Same as --repo
  CENTRAL_DATABASE        Same as --database
  CENTRAL_POSTGRES        Same as --postgres
  CENTRAL_DOMAIN          Same as --domain

Examples:
  bash install.sh --domain central.example.com --postgres docker
  bash install.sh --database sqlite --sqlite-path ./data/central.db
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --fresh) FRESH=1; shift ;;
    --no-clone) NO_CLONE=1; shift ;;
    --no-interactive) INTERACTIVE=0; shift ;;
    --database) DATABASE_TYPE="$2"; shift 2 ;;
    --postgres) POSTGRES_MODE="$2"; shift 2 ;;
    --sqlite-path) SQLITE_PATH="$2"; shift 2 ;;
    --domain) PUBLIC_DOMAIN="$2"; shift 2 ;;
    --url) PUBLIC_URL="$2"; shift 2 ;;
    --systemd) USE_SYSTEMD=1; shift ;;
    --no-systemd) USE_SYSTEMD=0; shift ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

[[ -z "$DATABASE_TYPE" && -n "${CENTRAL_DATABASE:-}" ]] && DATABASE_TYPE="$CENTRAL_DATABASE"
[[ -z "$POSTGRES_MODE" && -n "${CENTRAL_POSTGRES:-}" ]] && POSTGRES_MODE="$CENTRAL_POSTGRES"
[[ -z "$PUBLIC_DOMAIN" && -n "${CENTRAL_DOMAIN:-}" ]] && PUBLIC_DOMAIN="$CENTRAL_DOMAIN"

command -v git >/dev/null || { echo "git is required" >&2; exit 1; }

rand_secret() {
  if command -v openssl >/dev/null; then
    openssl rand -base64 32 | tr -d '\n'
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n'
  fi
}

ensure_node() {
  if command -v node >/dev/null; then
    local major
    major=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
    if [[ "$major" -ge 20 ]]; then return 0; fi
    echo "Node.js 20+ required (found $(node -v))." >&2
  fi
  if [[ $INTERACTIVE -eq 1 ]]; then
    read -r -p "Install Node.js 20 via NodeSource? [Y/n]: " yn
    yn="${yn:-Y}"
    if [[ ! "$yn" =~ ^[Yy] ]]; then
      echo "Install Node.js 20+ manually: https://nodejs.org" >&2
      exit 1
    fi
  fi
  if [[ -f /etc/debian_version ]] && command -v curl >/dev/null; then
    echo "Installing Node.js 20 (NodeSource)…"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    return 0
  fi
  echo "Node.js 20+ is required. Install manually and re-run." >&2
  exit 1
}

if [[ $FRESH -eq 1 && -d "$INSTALL_DIR" ]]; then
  echo "Removing $INSTALL_DIR (--fresh)…"
  rm -rf "$INSTALL_DIR"
fi

UPGRADE=0
if [[ $NO_CLONE -eq 1 ]]; then
  if [[ ! -f "$INSTALL_DIR/package.json" ]]; then
    echo "No package.json in $INSTALL_DIR" >&2
    exit 1
  fi
  echo "Using existing checkout at $INSTALL_DIR (--no-clone)"
  cd "$INSTALL_DIR"
  [[ -d .git ]] && UPGRADE=1
elif [[ -d "$INSTALL_DIR/.git" ]]; then
  UPGRADE=1
  echo "Upgrading existing install at $INSTALL_DIR"
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  echo "Cloning $REPO_URL into $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  FRESH_ENV=1
fi

ensure_node

ensure_env_file() {
  if [[ -f .env ]]; then return 0; fi
  FRESH_ENV=1
  if [[ -f .env.production.example ]]; then
    cp .env.production.example .env
    echo "Created .env from .env.production.example"
    return 0
  fi
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "Created .env from .env.example"
    return 0
  fi
  cat > .env <<'EOF'
CENTRAL_EDITION=control_plane
CENTRAL_DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://central:central@127.0.0.1:5432/central?schema=central
REDIS_URL=redis://127.0.0.1:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
DEPLOYMENT_MODE=self_hosted
ENABLE_CREDENTIAL_AUTH=true
EOF
  echo "Created minimal .env"
}

env_get() {
  local key="$1"
  [[ -f .env ]] || return 1
  local line raw val
  line=$(grep -E "^${key}=" .env 2>/dev/null | head -1 || true)
  [[ -n "$line" ]] || return 1
  raw="${line#*=}"
  val="$raw"
  if [[ "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; fi
  if [[ "$val" =~ ^\'(.*)\'$ ]]; then val="${BASH_REMATCH[1]}"; fi
  printf '%s' "$val"
}

env_set() {
  local key="$1" val="$2"
  local tmp
  tmp=$(mktemp)
  if [[ -f .env ]]; then
    grep -v "^${key}=" .env > "$tmp" 2>/dev/null || true
  else
    : > "$tmp"
  fi
  printf '%s=%s\n' "$key" "$val" >> "$tmp"
  mv "$tmp" .env
}

generate_secrets_if_needed() {
  [[ $FRESH_ENV -eq 1 ]] || return 0
  local auth enc
  auth=$(env_get BETTER_AUTH_SECRET || true)
  enc=$(env_get ENCRYPTION_KEY || true)
  if [[ -z "$auth" || "$auth" == *"replace"* || "$auth" == *"dev-only"* ]]; then
    env_set BETTER_AUTH_SECRET "$(rand_secret)"
    echo "Generated BETTER_AUTH_SECRET"
  fi
  if [[ -z "$enc" ]]; then
    env_set ENCRYPTION_KEY "$(rand_secret)"
    echo "Generated ENCRYPTION_KEY"
  fi
  grep -q '^CENTRAL_EDITION=' .env 2>/dev/null || env_set CENTRAL_EDITION control_plane
  grep -q '^DEPLOYMENT_MODE=' .env 2>/dev/null || env_set DEPLOYMENT_MODE self_hosted
}

apply_public_url() {
  local origin="$1"
  origin="${origin%/}"
  env_set NEXT_PUBLIC_APP_URL "$origin"
  env_set BETTER_AUTH_URL "$origin"
  echo "Set public URL to $origin"
}

resolve_public_url() {
  if [[ -n "$PUBLIC_URL" ]]; then
    apply_public_url "$PUBLIC_URL"
    return
  fi
  if [[ -n "$PUBLIC_DOMAIN" ]]; then
    if [[ "$PUBLIC_DOMAIN" =~ ^https?:// ]]; then
      apply_public_url "$PUBLIC_DOMAIN"
    else
      apply_public_url "https://${PUBLIC_DOMAIN}"
    fi
    return
  fi
  if [[ $INTERACTIVE -eq 1 && $UPGRADE -eq 0 ]]; then
    local current
    current=$(env_get NEXT_PUBLIC_APP_URL || true)
    read -r -p "Public URL for this install [${current:-https://central.example.com}]: " url_in
    url_in="${url_in:-${current:-https://central.example.com}}"
    if [[ -n "$url_in" && "$url_in" != "http://localhost:3000" ]]; then
      apply_public_url "$url_in"
    fi
  fi
}

load_env() {
  ensure_env_file
  local v
  v=$(env_get CENTRAL_DATABASE_PROVIDER || true)
  [[ -n "$v" ]] && export CENTRAL_DATABASE_PROVIDER="$v"
  v=$(env_get DATABASE_URL || true)
  [[ -n "$v" ]] && export DATABASE_URL="$v"
  v=$(env_get REDIS_URL || true)
  [[ -n "$v" ]] && export REDIS_URL="$v"
}

require_database_url() {
  load_env
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL is missing in .env" >&2
    exit 1
  fi
  if [[ "${CENTRAL_DATABASE_PROVIDER:-postgresql}" == "postgresql" ]] && [[ "$DATABASE_URL" == *"USER:PASSWORD"* ]]; then
    echo "ERROR: DATABASE_URL is still a placeholder in .env" >&2
    exit 1
  fi
}

install_cli_symlink() {
  local cli="$INSTALL_DIR/scripts/central-cli"
  [[ -f "$cli" ]] || return 0
  local target="/usr/local/bin/central-cli"
  if [[ -w /usr/local/bin ]] || [[ "$(id -u)" -eq 0 ]]; then
    ln -sf "$cli" "$target" 2>/dev/null && echo "Linked central-cli → $target" && return
  fi
  mkdir -p "$HOME/.local/bin"
  ln -sf "$cli" "$HOME/.local/bin/central-cli"
  echo "Linked central-cli → $HOME/.local/bin/central-cli (add to PATH if needed)"
}

install_systemd_units() {
  local want=0
  if [[ "$USE_SYSTEMD" == "1" ]]; then want=1
  elif [[ "$USE_SYSTEMD" == "0" ]]; then return 0
  elif [[ "$(id -u)" -eq 0 ]] && command -v systemctl >/dev/null; then want=1
  fi
  [[ $want -eq 1 ]] || return 0
  [[ -d deploy/systemd ]] || return 0

  local npm_bin
  npm_bin=$(command -v npm || echo /usr/bin/npm)
  for unit in central-server central-deploy-worker; do
    local src="deploy/systemd/${unit}.service"
    local dest="/etc/systemd/system/${unit}.service"
    sed -e "s|__INSTALL_DIR__|$INSTALL_DIR|g" -e "s|/usr/bin/npm|$npm_bin|g" "$src" > "/tmp/${unit}.service"
    cp "/tmp/${unit}.service" "$dest"
  done
  systemctl daemon-reload
  systemctl enable central-server central-deploy-worker
  systemctl restart central-server central-deploy-worker || systemctl start central-server central-deploy-worker
  echo "systemd units enabled: central-server, central-deploy-worker"
}

start_pm2_fallback() {
  if systemctl is-active --quiet central-server 2>/dev/null; then return 0; fi
  if command -v pm2 >/dev/null; then
    npm run pm2:start 2>/dev/null || npm run pm2:restart 2>/dev/null || true
    echo "Started via PM2"
    return 0
  fi
  echo ""
  echo "Start manually:"
  echo "  cd $INSTALL_DIR && npm start"
  echo "  cd $INSTALL_DIR && npm run worker:deploy   # separate terminal"
}

post_install_health() {
  echo "Running db:verify…"
  npm run db:verify 2>/dev/null || echo "db:verify reported issues — check DATABASE_URL"
  local origin
  origin=$(env_get NEXT_PUBLIC_APP_URL || echo http://127.0.0.1:3000)
  if command -v curl >/dev/null; then
    sleep 2
    if curl -fsS -o /dev/null -w "%{http_code}" "${origin}/api/setup/status" 2>/dev/null | grep -qE '200|503'; then
      echo "API reachable at ${origin}/api/setup/status"
    else
      curl -fsS "http://127.0.0.1:${PORT:-3000}/api/setup/status" >/dev/null 2>&1 \
        && echo "API reachable locally on port ${PORT:-3000}" \
        || echo "API not yet reachable — start services and open /setup"
    fi
  fi
}

ensure_env_file
generate_secrets_if_needed
resolve_public_url

if [[ $INTERACTIVE -eq 1 && -z "$DATABASE_TYPE" ]]; then
  echo ""
  echo "Database type:"
  echo "  1) PostgreSQL (recommended for production)"
  echo "  2) SQLite (local trial — single node, not for production)"
  read -r -p "Choice [1-2] [1]: " db_choice
  case "${db_choice:-1}" in
    2) DATABASE_TYPE=sqlite ;;
    *) DATABASE_TYPE=postgresql ;;
  esac
fi

DATABASE_TYPE="${DATABASE_TYPE:-postgresql}"

if [[ "$DATABASE_TYPE" == "sqlite" ]]; then
  env_set CENTRAL_DATABASE_PROVIDER sqlite
  export CENTRAL_DATABASE_PROVIDER=sqlite
  if [[ $INTERACTIVE -eq 1 && -z "${CENTRAL_SQLITE_PATH:-}" && "$SQLITE_PATH" == "./data/central.db" ]]; then
    read -r -p "SQLite file path [./data/central.db]: " sp
    SQLITE_PATH="${sp:-./data/central.db}"
  fi
  db_dir=$(dirname "$SQLITE_PATH")
  mkdir -p "$db_dir"
  sqlite_url="file:${SQLITE_PATH}"
  env_set DATABASE_URL "$sqlite_url"
  export DATABASE_URL="$sqlite_url"
  echo ""
  echo "WARNING: SQLite is for local trial only — use PostgreSQL for production."
else
  env_set CENTRAL_DATABASE_PROVIDER postgresql
  export CENTRAL_DATABASE_PROVIDER=postgresql

  if [[ $INTERACTIVE -eq 1 && -z "$POSTGRES_MODE" ]]; then
    echo ""
    echo "PostgreSQL setup:"
    echo "  1) Docker bundled (postgres + redis)"
    echo "  2) External DATABASE_URL"
    echo "  3) Skip (use DATABASE_URL in .env)"
    read -r -p "Choice [1-3] [1]: " pg_choice
    case "${pg_choice:-1}" in
      1) POSTGRES_MODE=docker ;;
      2) POSTGRES_MODE=external ;;
      3) POSTGRES_MODE=skip ;;
      *) POSTGRES_MODE=docker ;;
    esac
  fi

  POSTGRES_MODE="${POSTGRES_MODE:-docker}"

  case "$POSTGRES_MODE" in
    docker)
      if [[ -f docker-compose.install.yml ]] && command -v docker >/dev/null; then
        docker compose -f docker-compose.install.yml up -d postgres redis
        env_set DATABASE_URL 'postgresql://central:central@127.0.0.1:5432/central?schema=central'
        grep -q '^REDIS_URL=' .env 2>/dev/null || env_set REDIS_URL 'redis://127.0.0.1:6379'
      else
        echo "Docker not found — writing default DATABASE_URL to .env." >&2
        grep -q '^DATABASE_URL=' .env 2>/dev/null || env_set DATABASE_URL 'postgresql://central:central@127.0.0.1:5432/central?schema=central'
      fi
      load_env
      ;;
    external)
      load_env
      if [[ $INTERACTIVE -eq 1 ]]; then
        read -r -p "DATABASE_URL [${DATABASE_URL:-}]: " db_url
        db_url="${db_url:-$DATABASE_URL}"
        [[ -n "$db_url" ]] && env_set DATABASE_URL "$db_url" && export DATABASE_URL="$db_url"
      fi
      ;;
    skip)
      echo "Using DATABASE_URL from .env"
      require_database_url
      ;;
  esac
fi

require_database_url

export CENTRAL_DATABASE_PROVIDER="${DATABASE_TYPE}"
load_env

echo "Installing npm dependencies…"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "Applying database schema…"
load_env
if [[ "$DATABASE_TYPE" == "sqlite" ]]; then
  export CENTRAL_DATABASE_PROVIDER=sqlite
  db_url="$(env_get DATABASE_URL || true)"
  export DATABASE_URL="${db_url:-file:${SQLITE_PATH}}"
  npx prisma db push --schema prisma/schema.sqlite.prisma
else
  export CENTRAL_DATABASE_PROVIDER=postgresql
  set +e
  npx prisma migrate deploy --schema prisma/schema.postgresql.prisma
  migrate_status=$?
  set -e
  if [[ $migrate_status -ne 0 ]]; then
    echo "migrate deploy failed; trying db:bootstrap + db:apply-patches…"
    npm run db:bootstrap 2>/dev/null || true
    npm run db:apply-patches 2>/dev/null || true
  fi
fi

echo "Building application…"
npm run build

install_cli_symlink
install_systemd_units
start_pm2_fallback
post_install_health

echo ""
if [[ $UPGRADE -eq 1 ]]; then
  echo "Upgrade complete at $INSTALL_DIR"
else
  echo "Install complete at $INSTALL_DIR"
fi
echo "Provider: $DATABASE_TYPE"
origin=$(env_get NEXT_PUBLIC_APP_URL || echo "http://localhost:3000")
echo "Next: open ${origin%/}/setup for first admin and GitHub App configuration"
echo "Run: central-cli doctor"
