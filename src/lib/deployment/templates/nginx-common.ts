import { indent, joinLines } from "@/lib/deployment/templates/format";

/** First hostname from a space-separated server_name list (e.g. apex for cert paths). */
export function primaryServerHostname(serverName: string): string {
  const first = serverName.trim().split(/\s+/)[0];
  return first ?? "";
}

/**
 * TLS paths for generated nginx: explicit server fields, else Cloudflare origin layout
 * `/etc/ssl/cloudflare/<hostname>-origin.pem` on the deploy host.
 */
export function resolveNginxTlsPaths(input: {
  tlsCertPath?: string;
  tlsKeyPath?: string;
  serverName: string;
}): { cert: string; key: string } | null {
  const explicitCert = input.tlsCertPath?.trim();
  const explicitKey = input.tlsKeyPath?.trim();
  if (explicitCert && explicitKey) {
    return { cert: explicitCert, key: explicitKey };
  }

  const host = primaryServerHostname(input.serverName);
  if (!host || host.endsWith(".local")) {
    return null;
  }

  // Cloudflare origin certs are often named for the apex (e.g. centralstackhq-origin.pem).
  const parts = host.split(".");
  const certHost = parts.length >= 2 ? parts.slice(-2).join(".") : host;

  return {
    cert: `/etc/ssl/cloudflare/${certHost}-origin.pem`,
    key: `/etc/ssl/cloudflare/${certHost}-origin.key`
  };
}

export type NginxTemplateInput = {
  serverName: string;
  upstreamHost: string;
  upstreamPort: number;
  framework?: string | null;
  deploymentPath?: string;
  restartCommand?: string | null;
  mapSuffix?: string;
  accessLog?: string;
  errorLog?: string;
  tlsCertPath?: string;
  tlsKeyPath?: string;
  clientMaxBodySize?: string;
};

export function httpRedirectServer(serverName: string): string {
  return joinLines([
    "server {",
    indent(
      4,
      joinLines([
        "listen 80;",
        "listen [::]:80;",
        `server_name ${serverName};`,
        "",
        "return 301 https://$host$request_uri;"
      ])
    ),
    "}"
  ]);
}

/** Laravel / PHP-FPM document root: `<appRoot>/current/public` (release symlink layout). */
export function laravelDocumentRoot(deploymentPath: string): string {
  const base = deploymentPath.replace(/\/+$/, "") || "/var/www/app";
  if (base.endsWith("/current/public")) return base;
  if (base.endsWith("/public")) {
    const parent = base.replace(/\/public$/, "");
    return `${parent}/current/public`;
  }
  return `${base}/current/public`;
}

/** Infer PHP-FPM socket from project restart command or default 8.4. */
export function inferPhpFpmSocket(restartCommand?: string | null): string {
  const m = restartCommand?.match(/php(\d+\.\d+)-fpm/i);
  if (m) return `unix:/run/php/php${m[1]}-fpm.sock`;
  return "unix:/run/php/php8.4-fpm.sock";
}

export function normalizeFramework(framework?: string | null): string {
  return (framework ?? "").trim().toLowerCase();
}

export function isPhpFpmStack(framework?: string | null, runtime?: string | null): boolean {
  const fw = normalizeFramework(framework);
  const rt = (runtime ?? "").trim().toLowerCase();
  return (
    fw === "laravel" ||
    fw === "laravel-react" ||
    fw === "php" ||
    rt === "php-fpm" ||
    rt === "php"
  );
}

export function isStaticStack(framework?: string | null, runtime?: string | null): boolean {
  const fw = normalizeFramework(framework);
  const rt = (runtime ?? "").trim().toLowerCase();
  return fw === "static" && rt === "static";
}

/** Origins allowed to embed deployed apps in the Central dashboard iframe. */
export function resolveDashboardFrameAncestors(): string[] {
  const out = new Set<string>();

  for (const part of process.env.CENTRAL_FRAME_ANCESTORS?.split(",") ?? []) {
    const t = part.trim().replace(/\/+$/, "");
    if (t) out.add(t);
  }

  for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      out.add(u.origin);
      const parts = u.hostname.split(".");
      if (parts.length >= 2) {
        const apex = parts.slice(-2).join(".");
        out.add(`https://*.${apex}`);
      }
    } catch {
      out.add(raw.replace(/\/+$/, ""));
    }
  }

  const wildcard = process.env.CENTRAL_FRAME_ANCESTOR_WILDCARD?.trim();
  if (wildcard) out.add(wildcard.replace(/\/+$/, ""));

  return [...out];
}

/** Nginx headers so the dashboard can iframe this site (replaces X-Frame-Options SAMEORIGIN). */
export function dashboardEmbedNginxLines(): string[] {
  const ancestors = resolveDashboardFrameAncestors();
  if (ancestors.length === 0) {
    return ['add_header X-Frame-Options "SAMEORIGIN" always;'];
  }
  const list = ["'self'", ...ancestors].join(" ");
  return [`add_header Content-Security-Policy "frame-ancestors ${list};" always;`];
}
