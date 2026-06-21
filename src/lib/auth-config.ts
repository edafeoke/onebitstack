import { isControlPlaneEdition } from "@/lib/edition";
export function resolveAuthBaseUrl(): string {
  const raw =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3100";
  return raw.replace(/\/+$/, "");
}

export function resolveTrustedOrigins(baseURL: string): string[] {
  const origins = new Set<string>([baseURL]);
  const pub = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (pub) origins.add(pub.replace(/\/+$/, ""));
  const extra = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? [];
  for (const o of extra) {
    const t = o.trim();
    if (t) origins.add(t.replace(/\/+$/, ""));
  }
  return [...origins];
}

/** GitHub OAuth for login (OAuth App vars, with optional GitHub App client fallback). */
export function resolveGithubOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId =
    process.env.GITHUB_CLIENT_ID?.trim() ||
    process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret =
    process.env.GITHUB_CLIENT_SECRET?.trim() ||
    process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGithubLoginConfigured(): boolean {
  return resolveGithubOAuthCredentials() !== null;
}

/** Hosted SaaS vs operator self-host (copy and defaults only). */
export function isSaasMode(): boolean {
  const mode = process.env.DEPLOYMENT_MODE?.trim().toLowerCase();
  if (mode === "self_hosted" || mode === "self-hosted") return false;
  if (mode === "saas") return true;
  // Control plane installs default to self-hosted; website edition may use SaaS later.
  if (isControlPlaneEdition()) return false;
  return true;
}

/** Email/password auth — default on for control plane setup and SaaS website. */
export function isCredentialAuthEnabled(): boolean {
  const v = process.env.ENABLE_CREDENTIAL_AUTH?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  if (isControlPlaneEdition()) return true;
  return isSaasMode();
}

/** Override localhost auth URLs when deploying behind a public project domain. */
export function withProductionAuthUrls(
  env: Record<string, string>,
  domain?: string | null
): Record<string, string> {
  const host = domain?.trim();
  if (!host) return env;
  const origin = /^https?:\/\//i.test(host)
    ? host.replace(/\/+$/, "")
    : `https://${host}`;
  const out = { ...env };
  for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const v = out[key]?.trim();
    if (!v || /localhost|127\.0\.0\.1/i.test(v)) out[key] = origin;
  }
  return out;
}
