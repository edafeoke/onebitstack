import {
  isCredentialAuthEnabled,
  isGithubLoginConfigured,
  isSaasMode
} from "@/lib/auth-config";
import { getEdition } from "@/lib/edition";

export const runtime = "nodejs";

function githubAppPrivateKey(): string {
  return (
    process.env.GITHUB_PRIVATE_KEY?.trim() ||
    process.env.GITHUB_APP_PRIVATE_KEY?.trim() ||
    ""
  );
}

export async function GET(): Promise<Response> {
  const githubLogin = isGithubLoginConfigured();
  const githubAppConfigured =
    Boolean(process.env.GITHUB_APP_ID?.trim()) &&
    Boolean(githubAppPrivateKey()) &&
    Boolean(process.env.GITHUB_APP_CLIENT_ID?.trim()) &&
    Boolean(process.env.GITHUB_APP_CLIENT_SECRET?.trim());
  const githubAppSlug =
    process.env.NEXT_PUBLIC_GITHUB_APP_SLUG?.trim() ||
    process.env.GITHUB_APP_SLUG?.trim() ||
    "";
  return Response.json({
    githubLogin,
    credentialAuth: isCredentialAuthEnabled(),
    saasMode: isSaasMode(),
    edition: getEdition(),
    githubAppConfigured,
    githubAppSlug
  });
}
