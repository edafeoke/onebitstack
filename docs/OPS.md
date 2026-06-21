# Central server — VPS operations

Operator runbook for VPS deploy paths, sudo, and troubleshooting. For product scope, personas, and roadmap see [PRD.md](./PRD.md).

## SSH user and sudo

Deployments run as the configured SSH user. Nginx/Apache steps need root for `/etc/nginx`, `systemctl reload`, etc.

**Option A — passwordless sudo (recommended)** for user `deploy` on the VPS:

```bash
sudo visudo -f /etc/sudoers.d/central-deploy
```

```
deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl, /bin/cp, /bin/ln, /bin/rm, /bin/test, /usr/sbin/apachectl, /usr/sbin/a2ensite, /bin/chown, /bin/chmod, /bin/mkdir, /usr/bin/php, /usr/bin/apt-get
```

Or a broader (less strict) line:

```
deploy ALL=(ALL) NOPASSWD: ALL
```

**Option B** — use the `root` SSH user (no sudo); not ideal for production.

Remote scripts use `sudo -n` so a missing sudoers rule fails immediately with a clear log line instead of waiting for a password.

**Project delete** runs cleanup over SSH before removing the project from Central: stops PM2 (Node/Python), removes nginx/apache vhosts, deletes the app directory (only when `deploymentPath` ends with the project slug, e.g. `<deployRoot>/apps/<slug>`), logs, and `<deployRoot>/data/<slug>/`. The shared legacy root `/var/www/app` is **never** removed wholesale. Delete is blocked if cleanup fails or the path is unsafe. Ensure sudoers allows `rm`, `systemctl`, `nginx`, `apachectl`, and `a2dissite` as needed.

## Paths

- **VPS deploy root** (per server, default `/var/www/server`): Central stores all deployed sites under this tree:
  - `<deployRoot>/apps/<slug>` — application checkout (`deploymentPath`)
  - `<deployRoot>/configs/{nginx,apache,pm2}` — generated proxy/PM2 drops
  - `<deployRoot>/data/<slug>/app.db` — persistent SQLite
  - `<deployRoot>/logs/<slug>/` — PM2 and app logs
  - `<deployRoot>/ssl/central/<slug>/` — optional uploaded TLS (if paths not set on server)
- **Release layout:** `releases/{deploymentId}/` under the app root; `current` symlinks to the active release; `shared/.env` and `shared/storage/` persist across cutovers.
- **SQLite (production):** `<deployRoot>/data/<slug>/app.db` — outside the git tree so `git reset --hard` does not break a running app. Laravel deploys rewrite relative `DB_DATABASE` to this path and run `php artisan migrate --force`.
- **Laravel + SQLite on PHP 8.4:** install `php8.4-sqlite3` (generic `php-sqlite3` alone may not enable PDO for 8.4). Verify: `php -m | grep -i pdo_sqlite`. Re-provision PHP on the server or redeploy (Central will attempt `apt install php8.4-sqlite3` when missing).

### SQLite `SQLITE_READONLY_DBMOVED`

Usually means the DB file was replaced while PM2 still had it open (e.g. `file:./dev.db` in the repo during deploy). Fix:

```bash
mkdir -p /var/www/data/central-server
# optional: migrate old data
[ -f /var/www/central-server/dev.db ] && cp -an /var/www/central-server/dev.db /var/www/data/central-server/app.db
# set in project Env tab or .env:
# DATABASE_URL=file:/var/www/data/central-server/app.db
pm2 restart central-server --update-env
```

Redeploy from the dashboard after pulling the latest code (uses `/var/www/data/...`, does **not** run `prisma db push` during build — the control plane keeps SQLite open).

Schema sync on the VPS (when the app is stopped or from a one-off shell):

```bash
cd /var/www/central-server
DATABASE_URL="file:/var/www/data/central-server/app.db" npm run db:sync
pm2 restart central-server --update-env
```

## Git on the VPS

Deploys clone or build into `releases/{deploymentId}`, then atomically repoint `current`. Failed builds remove the new release directory without touching `current`.

Rollback (dashboard) repoints `current` to the previous successful release and reloads PM2/proxy configs.

If you pulled manually and see divergent branches or `next-env.d.ts` conflicts:

```bash
cd /var/www/central-server   # or your deploymentPath/repo slug
git fetch origin
git reset --hard origin/main
```

Do **not** commit on the server (`next-env.d.ts` changes after every build). Use the dashboard deploy or the commands above.

## Idempotency

- Git: existing behaviour refuses cloning into a non-empty non-git directory; updates discard local commits.
- Nginx: on `nginx -t` failure the previous site file is restored from `.bak.central` when present.
- PM2: `pm2 startOrReload` with ecosystem file.

## GitHub App

Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG` (or `NEXT_PUBLIC_GITHUB_APP_SLUG`), and webhook secret `GITHUB_APP_WEBHOOK_SECRET` (or shared `GITHUB_WEBHOOK_SECRET`). Webhook URL: `POST /api/github/webhook`.

## Failure modes

- Invalid nginx config marks deployment **failed** after rollback attempt.
- SSH connectivity uses retries for transient TCP errors (see `deploy.ts`).

## PostgreSQL (control plane)

- **Standard:** `npx prisma migrate deploy` after `prisma/postgres-grants.sql` (superuser) if the app role cannot `CREATE` on `public`.
- **Restricted `public`:** `npm run db:bootstrap` creates schema `central` and records the baseline migration.
- **Verify:** `npm run db:verify` checks connectivity and that `user` table exists in `central` or `public`.

## TLS (Let's Encrypt)

Issue certs from the server **SSL** panel or run certbot on the VPS. Schedule automatic renewal on each server:

```bash
# /etc/cron.d/certbot-central (example — adjust paths)
0 3 * * * root certbot renew --quiet && nginx -s reload
```

Central stores certificate expiry on the server record when you verify paths or use **Renew now**; the dashboard **Health** card warns before `SSL_EXPIRY_WARN_DAYS` (default 14).
