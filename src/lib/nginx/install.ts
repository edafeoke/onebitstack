import { RUN_ROOT_HELPER } from "@/lib/deploy/remote-shell";

function bashQ(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

export type NginxInstallPaths = {
  slug: string;
  configDropPath: string;
  siteAvailable: string;
  siteEnabled: string;
};

export function nginxInstallPaths(slug: string, configsNginxDir: string): NginxInstallPaths {
  return {
    slug,
    configDropPath: `${configsNginxDir}/${slug}.conf`,
    siteAvailable: `/etc/nginx/sites-available/${slug}.conf`,
    siteEnabled: `/etc/nginx/sites-enabled/${slug}.conf`
  };
}

/**
 * Remote script: refuse if another enabled site already lists one of HOSTS in server_name.
 */
export function buildNginxHostnamePreflightScript(input: {
  slug: string;
  hostnames: string[];
}): string {
  const hosts = input.hostnames.filter(Boolean);
  if (hosts.length === 0) return "exit 0";

  const hostList = hosts.map((h) => bashQ(h)).join(" ");
  return [
    "set -e",
    RUN_ROOT_HELPER,
    `SLUG=${bashQ(input.slug)}`,
    `HOSTS=${hostList}`,
    'for HOST in $HOSTS; do',
    "  for f in /etc/nginx/sites-enabled/*.conf; do",
    '    [ -e "$f" ] || continue',
    '    base=$(basename "$f" .conf)',
    '    [ "$base" = "$SLUG" ] && continue',
    '    if grep -E "^[[:space:]]*server_name\\s+" "$f" 2>/dev/null | grep -qF "$HOST"; then',
    '      echo "nginx hostname conflict: $HOST already in $f" >&2',
    "      exit 2",
    "    fi",
    "  done",
    "done",
    'echo "nginx hostname preflight ok"'
  ].join("\n");
}

/**
 * Atomic install: backup → copy → enable → nginx -t → reload or rollback (incl. sites-enabled).
 */
export function buildNginxSiteInstallScript(paths: NginxInstallPaths): string {
  return [
    "set -e",
    RUN_ROOT_HELPER,
    `DROP=${bashQ(paths.configDropPath)}`,
    `SITE=${bashQ(paths.siteAvailable)}`,
    `ENABLED=${bashQ(paths.siteEnabled)}`,
    `BAK=${bashQ(`${paths.siteAvailable}.bak.central`)}`,
    `if run_root test -f "$SITE"; then run_root cp "$SITE" "$BAK"; else run_root rm -f "$BAK"; fi`,
    `run_root cp "$DROP" "$SITE"`,
    `run_root ln -sfn "$SITE" "$ENABLED"`,
    `if ! run_root nginx -t 2>/dev/null; then`,
    `  run_root rm -f "$ENABLED"`,
    `  if run_root test -f "$BAK"; then run_root cp "$BAK" "$SITE"; else run_root rm -f "$SITE"; fi`,
    `  echo "nginx config test failed" >&2`,
    "  exit 1",
    "fi",
    "run_root systemctl reload nginx"
  ].join("\n");
}
