import { createGithubAppJwt } from "@/lib/github-app/jwt";
import { getGithubAppConfig } from "@/lib/github-app/config";

type InstallationTokenResponse = {
  token: string;
  expires_at: string;
};

/**
 * Exchange app JWT for a short-lived installation access token.
 */
export async function getInstallationAccessToken(
  installationId: string
): Promise<string> {
  const cfg = getGithubAppConfig();
  if (!cfg) {
    throw new Error("GitHub App is not configured (missing env vars).");
  }
  const jwt = createGithubAppJwt(cfg.appId, cfg.privateKey);
  const res = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub installation token failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const body = (await res.json()) as InstallationTokenResponse;
  if (!body.token) {
    throw new Error("GitHub installation token response missing token");
  }
  return body.token;
}
