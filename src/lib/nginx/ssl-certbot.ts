import { RUN_ROOT_HELPER } from "@/lib/deploy/remote-shell";

function bashQ(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

/**
 * Obtain/renew Let's Encrypt certs via certbot nginx plugin (requires certbot on VPS).
 */
export function buildCertbotNginxScript(input: {
  hostnames: string[];
  email: string;
  certPath: string;
  keyPath: string;
}): string {
  const domains = input.hostnames.filter((h) => h && !h.endsWith(".local"));
  if (domains.length === 0) {
    throw new Error("No public hostnames for Let's Encrypt ( .local domains are excluded).");
  }
  const domainFlags = domains.map((d) => `-d ${bashQ(d)}`).join(" ");
  const email = bashQ(input.email.trim());

  return [
    "set -e",
    RUN_ROOT_HELPER,
    "command -v certbot >/dev/null 2>&1 || { echo 'certbot not installed' >&2; exit 1; }",
    `run_root certbot certonly --nginx --non-interactive --agree-tos --email ${email} ${domainFlags} --keep-until-expiring`,
    `CERT_SRC=/etc/letsencrypt/live/${domains[0]}/fullchain.pem`,
    `KEY_SRC=/etc/letsencrypt/live/${domains[0]}/privkey.pem`,
    `CERT_DST=${bashQ(input.certPath)}`,
    `KEY_DST=${bashQ(input.keyPath)}`,
    'run_root mkdir -p "$(dirname "$CERT_DST")"',
    'run_root cp "$CERT_SRC" "$CERT_DST"',
    'run_root cp "$KEY_SRC" "$KEY_DST"',
    'run_root chmod 644 "$CERT_DST"',
    'run_root chmod 600 "$KEY_DST"',
    'echo "certbot certificates installed"'
  ].join("\n");
}

/** Run certbot renew on the VPS (typically via cron/systemd; dashboard can trigger manually). */
export function buildCertbotRenewScript(): string {
  return [
    "set -e",
    RUN_ROOT_HELPER,
    "command -v certbot >/dev/null 2>&1 || { echo 'certbot not installed' >&2; exit 1; }",
    "run_root certbot renew --nginx --non-interactive",
    "command -v nginx >/dev/null 2>&1 && run_root nginx -s reload || true",
    'echo "certbot renew complete"'
  ].join("\n");
}
