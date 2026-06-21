export type GithubAppCredentials = {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  appSlug: string;
};

export function getGithubAppConfig(): GithubAppCredentials | null {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey =
    process.env.GITHUB_PRIVATE_KEY?.trim() ||
    process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  const webhookSecret =
    process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() ||
    process.env.GITHUB_WEBHOOK_SECRET?.trim() ||
    "";
  const appSlug =
    process.env.GITHUB_APP_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_GITHUB_APP_SLUG?.trim() ||
    "";

  if (!appId || !privateKey || !clientId || !clientSecret) {
    return null;
  }
  return { appId, privateKey, clientId, clientSecret, webhookSecret, appSlug };
}

export function isGithubAppConfigured(): boolean {
  return getGithubAppConfig() !== null;
}
