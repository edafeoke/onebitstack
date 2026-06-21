# Central Server

Deploy Git repositories to your own VPS instances. The repo ships two editions:

| Edition | Deploy target | Purpose |
|---------|---------------|---------|
| **Website** | Vercel | Landing page, docs, install instructions (`CENTRAL_EDITION=website`) |
| **Control plane** | User VPS | Private deployment dashboard (`CENTRAL_EDITION=control_plane`) |

**Deployment guide:** [docs/DEPLOY.md](docs/DEPLOY.md) · **Docs:** [/docs](http://localhost:3000/docs) · **Install:** [/install](http://localhost:3000/install) · **VPS ops:** [docs/OPS.md](docs/OPS.md)

## Features (control plane)

- **Authentication** — Email/password + GitHub OAuth ([better-auth](https://www.better-auth.com/)); hosted **multi-tenant SaaS** model
- **Organizations** — Workspaces with owner / admin / developer / viewer roles
- **Servers** — SSH targets with encrypted private keys; optional **central-agent**; capability probe and provisioning
- **Projects** — Wizard: GitHub App → repo → branch → stack detection → deploy path and infra
- **Deployments** — Release-based deploys, streaming logs, rollback, push-to-deploy via signed webhooks
- **Queue** — BullMQ + Redis when `REDIS_URL` is set (recommended for production)
- **Infrastructure** — Generated nginx/Apache/PM2, env vars, Let's Encrypt (certbot), hostname conflict checks

## Tech stack

| Layer | Choice |
|--------|--------|
| App | Next.js 16 (App Router), React 19 |
| Auth | better-auth |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Queue | BullMQ + Redis (optional in-process fallback) |
| Remote | ssh2, SFTP; `packages/central-agent` |
| UI | Tailwind CSS 4, shadcn/ui |

## Prerequisites

- **Node.js** 20+ and npm
- **PostgreSQL** for production (control plane), or **SQLite** for local trial
- **Redis** (recommended) for durable deploy jobs — `docker compose up -d redis`
- **Git** on target VPS hosts
- **GitHub OAuth App** (login) and **GitHub App** (repos + webhooks)
- **Public HTTPS URL** for production webhooks (or a tunnel such as ngrok for development)

## Quick start

### Website (Vercel)

```bash
cp .env.website.example .env
# CENTRAL_EDITION=website, NEXT_PUBLIC_APP_URL=https://your-brand.com
npm install && npm run dev
```

Deploy to Vercel with `CENTRAL_EDITION=website`. No database required. See [docs/DEPLOY.md](docs/DEPLOY.md).

### Control plane (VPS)

```bash
curl -fsSL https://your-brand.com/install.sh | bash -s -- \
  --domain central.example.com --postgres docker
# Then open https://central.example.com/setup
```

Or for local development:

```bash
git clone https://github.com/centralstack/central-server.git
cd central-server
cp .env.production.example .env
docker compose -f docker-compose.install.yml up -d
npm install && npx prisma migrate deploy
npm run dev
# separate terminal: npm run worker:deploy
```

Open `/setup` for first admin on a fresh control plane install.

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

### Core

| Variable | Required | Description |
|----------|----------|-------------|
| `CENTRAL_DATABASE_PROVIDER` | Recommended | `postgresql` (production) or `sqlite` (local trial only) |
| `DATABASE_URL` | Yes | PostgreSQL URL (`?schema=central`) or `file:./data/central.db` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public origin of the app (UI + auth fallback) |
| `BETTER_AUTH_SECRET` | Yes | Session signing secret (32+ chars in production) |
| `BETTER_AUTH_URL` | Recommended | Canonical auth origin; defaults to `NEXT_PUBLIC_APP_URL` |
| `ENCRYPTION_KEY` | Yes (servers) | Encrypts SSH private keys at rest |
| `REDIS_URL` | **Required in production** | Redis for BullMQ (`redis://127.0.0.1:6379`) + distributed rate limits |
| `AGENT_PRIMARY` | Optional | Full deploys use central-agent only (no SSH fallback when paired) |
| `AGENT_JWT_SECRET` | Optional | Agent JWT signing (defaults to `BETTER_AUTH_SECRET`) |
| `DEPLOYMENT_MODE` | Optional | `self_hosted` (control plane default) or `saas` (optional hosted) |
| `CENTRAL_EDITION` | Recommended | `website` (Vercel) or `control_plane` (VPS install, default) |
| `ENABLE_CREDENTIAL_AUTH` | Optional | Email/password auth; default on for control plane setup |
| `PLATFORM_ADMIN_EMAIL` | Optional | After sign-up/sign-in, `npm run db:seed` promotes this user to platform admin |

### GitHub OAuth (sign in)

Create an OAuth App at [GitHub Developer settings](https://github.com/settings/developers).

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret |

**Callback URL:** `{BETTER_AUTH_URL}/api/auth/callback/github`  
Example: `http://localhost:3000/api/auth/callback/github`

### GitHub App (repos, stack detection, webhooks)

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | App ID |
| `GITHUB_APP_CLIENT_ID` | App client ID |
| `GITHUB_APP_CLIENT_SECRET` | App client secret |
| `GITHUB_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY` | PEM private key |
| `GITHUB_APP_SLUG` or `NEXT_PUBLIC_GITHUB_APP_SLUG` | App slug for install link |
| `GITHUB_APP_WEBHOOK_SECRET` or `GITHUB_WEBHOOK_SECRET` | Webhook secret |

**Webhook URL (required):**

```text
POST {PUBLIC_URL}/api/github/webhook
```

Do **not** use `/api/webhook` in production unless `ENABLE_LEGACY_GITHUB_WEBHOOK=true` (unsigned legacy route).

**Typical flow**

1. Set GitHub OAuth + App env vars and restart the app.
2. Sign in with **Continue with GitHub**.
3. Dashboard → Settings → **Install GitHub App**.
4. Confirm GitHub **Recent Deliveries** return **202**.

### Optional rate limits

See comments in `.env.example` (`GITHUB_WEBHOOK_REPO_RATE_LIMIT`, `DEPLOY_API_*`, etc.).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js in development |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run worker:deploy` | BullMQ deploy worker (needs `REDIS_URL`) |
| `npm run agent:pair` | Pair central-agent with a server |
| `npm run agent:run` | Run agent on VPS |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:push` | Push schema without migration history |
| `npm run db:bootstrap` | Bootstrap PG schema `central` when `public` is restricted |
| `npm run db:verify` | Check `DATABASE_URL` and that app tables exist |
| `npm run db:seed` | Promote `PLATFORM_ADMIN_EMAIL` user |
| `npm run install:sync` | Copy `scripts/install.sh` → `public/install.sh` |
| `npm run central:doctor` | Health checks (on installed VPS) |
| `npm run central:status` | Edition, URL, service status |
| `npm run build:website` | Production build with `CENTRAL_EDITION=website` |
| `npm test` | Unit tests |

After schema changes, `postinstall` runs `prisma generate` (uses `CENTRAL_DATABASE_PROVIDER` to pick `prisma/schema.postgresql.prisma` or `prisma/schema.sqlite.prisma` — update **both** when changing models).

### SQLite trial (local)

```bash
CENTRAL_DATABASE_PROVIDER=sqlite DATABASE_URL=file:./data/central.db npx prisma db push
npm run dev
```

Not recommended for production.

## Production checklist

1. Set `NODE_ENV=production`, `REDIS_URL`, and run **`npm run worker:deploy`** alongside the web app.
2. Run **`npm run db:verify`** after migrate or `db:bootstrap`. If migrate fails on `public`, use `prisma/postgres-grants.sql` or `db:bootstrap` (see [docs/OPS.md](docs/OPS.md)).
3. Optional: pair **central-agent** on each VPS and set `AGENT_PRIMARY=true` to avoid SSH from the control plane for full deploys.
4. Schedule **certbot renew** on each VPS (see OPS.md).

## VPS operations

Deployments expect a dedicated SSH user with **passwordless sudo** for nginx/Apache reload and related commands. See [docs/OPS.md](docs/OPS.md).

| Path | Purpose |
|------|---------|
| `<deployRoot>/apps/<slug>` | Application releases (`deploymentPath`) |
| `<deployRoot>/configs/nginx` | Generated nginx configs |
| `<deployRoot>/configs/apache` | Generated Apache configs |
| `<deployRoot>/configs/pm2` | PM2 ecosystem files |
| `<deployRoot>/logs/<slug>/` | App and PM2 logs |
| `<deployRoot>/data/<slug>/` | Persistent app data (e.g. Laravel SQLite on VPS) |

## API routes (reference)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/github/webhook` | Signed GitHub App events |
| `POST` | `/api/webhook` | Legacy unsigned webhook (env-gated) |
| `GET` | `/api/features` | Auth feature flags |
| `POST` | `/api/deploy` | Queue a deployment |
| `POST` | `/api/github/detect-stack` | Detect repo stack |
| `GET` | `/api/github/installations` | List installations |
| `POST` | `/api/agent/pair` | Pair VPS agent |

See [docs/PRD.md](docs/PRD.md) Appendix B for agent and deployment APIs.

## Project layout

```text
src/
  app/                  # Next.js routes (dashboard, auth, API)
  components/           # UI panels
  lib/
    auth/               # RBAC permissions
    deploy/             # SSH, releases, apply-infra
    nginx/              # Domains, install, certbot
    github/             # Webhooks, detection, pipelines
    queue/              # Redis / BullMQ helpers
packages/central-agent/ # VPS agent CLI
worker/                 # deploy-worker.ts
prisma/                 # PostgreSQL schema + migrations
docs/
  PRD.md                # Product requirements
  OPS.md                # VPS operator notes
```

## Security notes

- Keep `.env` and secrets out of git.
- Rotate `BETTER_AUTH_SECRET` and webhook secrets if exposed.
- SSH keys are encrypted with `ENCRYPTION_KEY` before storage.
- Run `npm run worker:deploy` alongside the app when using Redis.

## License

Private — see repository owner for terms.
