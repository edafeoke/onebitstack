import { RUN_ROOT_HELPER } from "@/lib/deploy/remote-shell";

/** Ensure PDO SQLite is loaded for `php` CLI (and reload FPM when a versioned unit exists). */
export function buildEnsurePhpSqliteExtensionScript(): string {
  return [
    "set -e",
    RUN_ROOT_HELPER,
    `if php -r 'exit(extension_loaded("pdo_sqlite")?0:1);' 2>/dev/null; then :; else`,
    'PHP_VER=$(php -r \'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;\' 2>/dev/null || echo "8.4")',
    "run_root apt-get update -y",
    'run_root apt-get install -y "php${PHP_VER}-sqlite3" php-sqlite3 || run_root apt-get install -y "php${PHP_VER}-sqlite3" || run_root apt-get install -y php-sqlite3',
    `if ! php -r 'exit(extension_loaded("pdo_sqlite")?0:1);' 2>/dev/null; then`,
    '  echo "[env] PHP PDO SQLite (pdo_sqlite) is not available. Install php${PHP_VER}-sqlite3 on the server." >&2',
    "  exit 1",
    "fi",
    'run_root systemctl reload "php${PHP_VER}-fpm" 2>/dev/null || run_root systemctl reload php-fpm 2>/dev/null || true',
    "fi"
  ].join("\n");
}

export function formatSqliteDriverHint(phpVersion = "8.4"): string {
  return `Install the SQLite extension: sudo apt install php${phpVersion}-sqlite3 && sudo systemctl reload php${phpVersion}-fpm`;
}
