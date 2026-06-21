import { getDraftCredentialsCookie } from "@/lib/github-app/setup-auth";
import { isControlPlaneEdition } from "@/lib/edition";
import { isSetupCompleted } from "@/lib/setup-state";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { getSession } from "@/lib/require-session";
import {
  decodeSignedJson,
  type GithubAppDraftCredentials
} from "@/lib/github-app/setup";

export async function canWriteEnvDuringSetup(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!isControlPlaneEdition()) {
    return { ok: false, error: "Env writes are only available on the control plane edition." };
  }
  const completed = await isSetupCompleted();
  if (!completed) return { ok: true };
  const session = await getSession();
  if (session?.user && (await isPlatformAdmin(session.user.id))) {
    return { ok: true };
  }
  return { ok: false, error: "Setup is complete. Sign in as platform admin for repair." };
}

export async function readGithubDraftFromCookie(): Promise<GithubAppDraftCredentials | null> {
  const raw = await getDraftCredentialsCookie();
  if (!raw) return null;
  return decodeSignedJson<GithubAppDraftCredentials>(raw);
}
