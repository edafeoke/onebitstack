import type { DeployTarget } from "@/lib/deploy/types";
import { RUN_ROOT_HELPER } from "@/lib/deploy/remote-shell";
import { withSshSession } from "@/lib/deploy/ssh-session";

export type ServerCapabilities = {
  git?: string;
  node?: string;
  pm2?: string;
  nginx?: string;
  apache?: string;
  docker?: string;
  bun?: string;
  php?: string;
  phpFpm?: string;
  phpSqlite?: string;
  composer?: string;
  python?: string;
};

function bashSingleQuoted(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

async function ver(
  ssh: { execCapture: (c: string) => Promise<string> },
  cmd: string
): Promise<string | undefined> {
  try {
    const o = (await ssh.execCapture(`bash -lc ${bashSingleQuoted(cmd)}`)).trim();
    return o.length ? o : undefined;
  } catch {
    return undefined;
  }
}

export async function probeDebianServer(target: DeployTarget): Promise<ServerCapabilities> {
  return await withSshSession(target, undefined, {}, async (ssh) => {
    const [git, node, pm2, nginx, apache, docker, bun, php, phpFpm, phpSqlite, composer, python] =
      await Promise.all([
        ver(ssh, "git --version 2>/dev/null | head -1 || true"),
        ver(ssh, "command -v node >/dev/null 2>&1 && node -v || true"),
        ver(ssh, "command -v pm2 >/dev/null 2>&1 && pm2 -v || true"),
        ver(ssh, "command -v nginx >/dev/null 2>&1 && nginx -v 2>&1 || true"),
        ver(ssh, "command -v apache2 >/dev/null 2>&1 && apache2 -v 2>&1 | head -1 || true"),
        ver(ssh, "command -v docker >/dev/null 2>&1 && docker -v || true"),
        ver(ssh, "command -v bun >/dev/null 2>&1 && bun -v || true"),
        ver(ssh, "php -v 2>/dev/null | head -1 || true"),
        ver(
          ssh,
          'PHP_VER=$(php -r \'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;\' 2>/dev/null || echo ""); ' +
            'if [ -n "$PHP_VER" ] && command -v "php-fpm${PHP_VER}" >/dev/null 2>&1; then "php-fpm${PHP_VER}" -v 2>&1 | head -1; ' +
            'elif command -v php-fpm >/dev/null 2>&1; then php-fpm -v 2>&1 | head -1; ' +
            'elif systemctl is-active "php${PHP_VER}-fpm" >/dev/null 2>&1; then echo "php${PHP_VER}-fpm active"; ' +
            "else true; fi"
        ),
        ver(
          ssh,
          'php -r \'echo extension_loaded("pdo_sqlite") ? "pdo_sqlite enabled" : "";\' 2>/dev/null || true'
        ),
        ver(ssh, "command -v composer >/dev/null 2>&1 && composer -V 2>/dev/null | head -1 || true"),
        ver(ssh, "python3 --version 2>/dev/null || true")
      ]);
    const caps: ServerCapabilities = {};
    if (git) caps.git = git;
    if (node) caps.node = node;
    if (pm2) caps.pm2 = pm2;
    if (nginx) caps.nginx = nginx;
    if (apache) caps.apache = apache;
    if (docker) caps.docker = docker;
    if (bun) caps.bun = bun;
    if (php) caps.php = php;
    if (phpFpm) caps.phpFpm = phpFpm;
    if (phpSqlite) caps.phpSqlite = phpSqlite;
    if (composer) caps.composer = composer;
    if (python) caps.python = python;
    return caps;
  });
}

export type ProvisionFlags = {
  git: boolean;
  nginx: boolean;
  apache: boolean;
  node: boolean;
  pm2: boolean;
  docker: boolean;
  bun: boolean;
  php: boolean;
  python: boolean;
};

/** Idempotent apt-based install script (requires sudo). */
export function buildDebianProvisionScript(flags: ProvisionFlags): string {
  const parts = [
    "set -eux",
    "export DEBIAN_FRONTEND=noninteractive",
    RUN_ROOT_HELPER,
    "run_root apt-get update -y"
  ];
  if (flags.git) parts.push("run_root apt-get install -y git");
  if (flags.nginx) parts.push("run_root apt-get install -y nginx");
  if (flags.apache) parts.push("run_root apt-get install -y apache2");
  if (flags.docker) parts.push("run_root apt-get install -y docker.io");
  if (flags.php) {
    parts.push(
      'PHP_VER=$(php -r \'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;\' 2>/dev/null || echo "8.4")',
      'run_root apt-get install -y php-fpm php-cli php-mbstring php-xml php-curl php-zip php-sqlite3 "php${PHP_VER}-sqlite3" || run_root apt-get install -y php-fpm php-cli php-mbstring php-xml php-curl php-zip php-sqlite3',
      'run_root systemctl enable --now "php${PHP_VER}-fpm" 2>/dev/null || run_root systemctl enable --now php-fpm 2>/dev/null || true',
      'if ! command -v composer >/dev/null 2>&1; then curl -fsSL https://getcomposer.org/installer | run_root php -- --install-dir=/usr/local/bin --filename=composer; fi'
    );
  }
  if (flags.python) {
    parts.push("run_root apt-get install -y python3 python3-venv python3-pip");
  }
  if (flags.node) {
    parts.push(
      'if [ "$(id -u)" -eq 0 ]; then curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -; else curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -n bash -; fi',
      "run_root apt-get install -y nodejs"
    );
  }
  if (flags.pm2) {
    parts.push("run_root npm install -g pm2");
  }
  if (flags.bun) {
    parts.push("curl -fsSL https://bun.sh/install | bash || true");
  }
  return parts.join("\n");
}
