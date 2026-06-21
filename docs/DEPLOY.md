# Deployment guide

Two editions ship from one repository. Pick the target that matches what you are deploying.

| Edition | Env | Deploy to | Purpose |
|---------|-----|-----------|---------|
| **Website** | `CENTRAL_EDITION=website` | Vercel (or static host) | Landing, `/docs`, `/install` instructions |
| **Control plane** | `CENTRAL_EDITION=control_plane` (default) | User VPS | Private deployment dashboard |

Customize the product name with `APP_NAME` and `NEXT_PUBLIC_APP_NAME`.

---

## 1. Website (Vercel)

Public marketing and documentation only.

```bash
# Vercel environment (Production)
CENTRAL_EDITION=website
NEXT_PUBLIC_APP_URL=https://your-brand.com
NEXT_PUBLIC_INSTALL_URL=https://your-brand.com
APP_NAME=Your Product Name
NEXT_PUBLIC_APP_NAME=Your Product Name
```

- No PostgreSQL or Redis required.
- Middleware blocks dashboard, auth, and deploy APIs.
- See also: [Deploy the website](/docs/deploy/website) (in-app docs).

**Build command:** `npm run build` (default)

**Pre-deploy:** `npm run install:sync` so `public/install.sh` matches `scripts/install.sh`.

---

## 2. Control plane (VPS)

What your users install to manage their own deployments (Coolify-style private use).

### Quick install

```bash
curl -fsSL https://your-brand.com/install.sh | bash -s -- \
  --domain central.example.com \
  --database postgresql \
  --postgres docker
```

### What the installer does

1. Clone or upgrade the repo under `~/central-server` (configurable with `--dir`)
2. Install Node.js 20 on Debian/Ubuntu if missing
3. Generate `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY`
4. Start bundled Postgres + Redis (Docker) or use external `DATABASE_URL`
5. Run Prisma migrations, `npm run build`
6. Install `central-cli` on PATH
7. Enable systemd units (`central-server`, `central-deploy-worker`) when run as root
8. Run `npm run db:verify` and probe `/api/setup/status`

### After install

1. Open `https://central.example.com/setup`
2. Save public URL, create platform admin, configure GitHub App
3. Run `central-cli doctor`

### Docker all-in-one

```bash
cp .env.production.example .env
# edit secrets and NEXT_PUBLIC_APP_URL
docker compose -f docker-compose.install.yml --profile app up -d
```

### CLI reference

```bash
central-cli install [--domain HOST] [--postgres docker]
central-cli upgrade
central-cli doctor
central-cli status
central-cli env init
central-cli github-app apply
central-cli uninstall
```

---

## Environment matrix

| Variable | Website | Control plane |
|----------|---------|---------------|
| `CENTRAL_EDITION` | `website` | `control_plane` |
| `DEPLOYMENT_MODE` | — | `self_hosted` |
| `DATABASE_URL` | omit | required (Postgres) |
| `REDIS_URL` | omit | required |
| `NEXT_PUBLIC_APP_URL` | Vercel domain | VPS domain |
| `ENCRYPTION_KEY` | omit | required |
| `BETTER_AUTH_SECRET` | omit | required |

Templates: [`.env.website.example`](../.env.website.example), [`.env.production.example`](../.env.production.example)

---

## Optional hosted SaaS

The codebase still supports `DEPLOYMENT_MODE=saas` for a future multi-tenant hosted control plane. That path requires PostgreSQL, Redis, a separate deploy worker, and is not the same as the website edition. See [README](../README.md) for notes.
