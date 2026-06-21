import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAppName } from "@/lib/app-config";
import { createGithubAppJwt, normalizeGithubAppPrivateKey } from "@/lib/github-app/jwt";
import {
  getGithubAppConfig,
  isGithubAppConfigured,
  type GithubAppCredentials
} from "@/lib/github-app/config";

export type GithubAppManifest = {
  name: string;
  url: string;
  hook_attributes: { url: string; active?: boolean };
  redirect_url: string;
  callback_urls: string[];
  public: boolean;
  default_events: string[];
  default_permissions: Record<string, string>;
  description?: string;
  request_oauth_on_install?: boolean;
};

export type GithubAppSetupField =
  | "appId"
  | "privateKey"
  | "clientId"
  | "clientSecret"
  | "webhookSecret"
  | "appSlug";

export type GithubAppSetupStatus = {
  configured: boolean;
  missing: GithubAppSetupField[];
  publicUrls: {
    webhook: string;
    oauthCallback: string;
    manifestRedirect: string;
  };
};

export type GithubAppDraftCredentials = {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  appSlug: string;
};

export type ManifestConversionResult = {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  appSlug: string;
  name: string;
};

const GITHUB_MANIFEST_NEW_URL = "https://github.com/settings/apps/new";

export function resolvePublicBaseUrl(fallback?: string): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    fallback?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function buildGithubAppManifest(baseUrl: string): GithubAppManifest {
  const origin = baseUrl.replace(/\/+$/, "");
  const appName = getAppName();
  return {
    name: appName.slice(0, 34),
    url: origin,
    description: `${appName} — deploy control for your VPS`,
    hook_attributes: {
      url: `${origin}/api/github/webhook`,
      active: true
    },
    redirect_url: `${origin}/setup/github/callback`,
    callback_urls: [`${origin}/api/auth/callback/github`],
    public: false,
    default_events: ["push", "installation"],
    default_permissions: {
      contents: "read",
      metadata: "read",
      pull_requests: "read"
    },
    request_oauth_on_install: true
  };
}

export function buildGithubManifestCreateUrl(
  baseUrl: string,
  state: string
): { formAction: string; manifestJson: string; state: string } {
  const manifest = buildGithubAppManifest(baseUrl);
  return {
    formAction: `${GITHUB_MANIFEST_NEW_URL}?state=${encodeURIComponent(state)}`,
    manifestJson: JSON.stringify(manifest),
    state
  };
}

export function getGithubAppSetupStatus(baseUrl?: string): GithubAppSetupStatus {
  const origin = resolvePublicBaseUrl(baseUrl);
  const missing: GithubAppSetupField[] = [];

  if (!process.env.GITHUB_APP_ID?.trim()) missing.push("appId");
  const pem =
    process.env.GITHUB_PRIVATE_KEY?.trim() ||
    process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!pem) missing.push("privateKey");
  if (!process.env.GITHUB_APP_CLIENT_ID?.trim()) missing.push("clientId");
  if (!process.env.GITHUB_APP_CLIENT_SECRET?.trim()) missing.push("clientSecret");
  const webhook =
    process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() ||
    process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!webhook) missing.push("webhookSecret");
  const slug =
    process.env.GITHUB_APP_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_GITHUB_APP_SLUG?.trim();
  if (!slug) missing.push("appSlug");

  return {
    configured: isGithubAppConfigured(),
    missing,
    publicUrls: {
      webhook: `${origin}/api/github/webhook`,
      oauthCallback: `${origin}/api/auth/callback/github`,
      manifestRedirect: `${origin}/setup/github/callback`
    }
  };
}

export function draftToCredentials(draft: GithubAppDraftCredentials): GithubAppCredentials {
  return {
    appId: draft.appId.trim(),
    privateKey: normalizeGithubAppPrivateKey(draft.privateKey),
    clientId: draft.clientId.trim(),
    clientSecret: draft.clientSecret.trim(),
    webhookSecret: draft.webhookSecret.trim(),
    appSlug: draft.appSlug.trim()
  };
}

export async function verifyGithubAppCredentials(
  cfg: GithubAppCredentials
): Promise<{ ok: true; slug?: string; name?: string } | { ok: false; error: string }> {
  try {
    const jwt = createGithubAppJwt(cfg.appId, cfg.privateKey);
    const res = await fetch("https://api.github.com/app", {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `GitHub API ${res.status}: ${body.slice(0, 300) || res.statusText}`
      };
    }
    const data = (await res.json()) as { slug?: string; name?: string };
    return { ok: true, slug: data.slug, name: data.name };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    return { ok: false, error: msg };
  }
}

/** PEM for .env: escape newlines as literal \n on one line. */
export function privateKeyForEnv(pem: string): string {
  return normalizeGithubAppPrivateKey(pem).replace(/\n/g, "\\n");
}

export function formatGithubAppEnvBlock(
  creds: GithubAppDraftCredentials | ManifestConversionResult,
  opts?: { comment?: string }
): string {
  const lines: string[] = [];
  if (opts?.comment) lines.push(`# ${opts.comment}`);
  lines.push(`GITHUB_APP_ID=${creds.appId}`);
  lines.push(`GITHUB_APP_CLIENT_ID=${creds.clientId}`);
  lines.push(`GITHUB_APP_CLIENT_SECRET=${creds.clientSecret}`);
  lines.push(`GITHUB_APP_WEBHOOK_SECRET=${creds.webhookSecret}`);
  lines.push(`GITHUB_PRIVATE_KEY=${privateKeyForEnv(creds.privateKey)}`);
  lines.push(`GITHUB_APP_SLUG=${creds.appSlug}`);
  lines.push(`NEXT_PUBLIC_GITHUB_APP_SLUG=${creds.appSlug}`);
  return lines.join("\n");
}

export async function exchangeManifestCode(
  code: string
): Promise<
  { ok: true; credentials: ManifestConversionResult; envBlock: string } | { ok: false; error: string }
> {
  const res = await fetch(
    `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Manifest conversion failed (${res.status}): ${body.slice(0, 400) || res.statusText}`
    };
  }

  const data = (await res.json()) as {
    id?: number;
    slug?: string;
    pem?: string;
    client_id?: string;
    client_secret?: string;
    webhook_secret?: string;
    name?: string;
  };

  if (
    data.id == null ||
    !data.pem ||
    !data.client_id ||
    !data.client_secret ||
    !data.webhook_secret
  ) {
    return { ok: false, error: "Incomplete response from GitHub manifest conversion." };
  }

  const credentials: ManifestConversionResult = {
    appId: String(data.id),
    privateKey: data.pem,
    clientId: data.client_id,
    clientSecret: data.client_secret,
    webhookSecret: data.webhook_secret,
    appSlug: data.slug ?? "",
    name: data.name ?? ""
  };

  return {
    ok: true,
    credentials,
    envBlock: formatGithubAppEnvBlock(credentials, {
      comment: "Generated from GitHub App manifest — restart the app after saving to .env"
    })
  };
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

export function generateManifestState(): string {
  return randomBytes(24).toString("hex");
}

function signingSecret(): string {
  return (
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "dev-only-better-auth-secret-min-32-characters-long!"
  );
}

export function signSetupPayload(payload: string): string {
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySignedSetupPayload<T>(signed: string): T | null {
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = signed.slice(0, i);
  const sig = signed.slice(i + 1);
  const expected = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function encodeSignedJson<T extends object>(value: T): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return signSetupPayload(payload);
}

export function decodeSignedJson<T>(signed: string): T | null {
  return verifySignedSetupPayload<T>(signed);
}

export { isGithubAppConfigured, getGithubAppConfig };
