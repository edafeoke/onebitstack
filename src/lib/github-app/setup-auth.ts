import "server-only";
import { cookies } from "next/headers";
import { isSaasMode } from "@/lib/auth-config";
import { isControlPlaneEdition } from "@/lib/edition";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { getSession } from "@/lib/require-session";
import { isGithubAppConfigured } from "@/lib/github-app/config";
import { isSetupCompleted } from "@/lib/setup-state";

const STATE_COOKIE = "central_github_manifest_state";
const DRAFT_COOKIE = "central_github_draft";
const STATE_MAX_AGE = 3600;
const DRAFT_MAX_AGE = 900;

export async function canAccessGithubAppSetup(): Promise<boolean> {
  if (isSaasMode()) return false;
  if (isControlPlaneEdition() && !(await isSetupCompleted())) return true;
  if (!isGithubAppConfigured()) return true;
  const session = await getSession();
  if (!session?.user) return false;
  return isPlatformAdmin(session.user.id);
}

export async function requireGithubAppSetupAccess(): Promise<
  { ok: true } | { ok: false; status: number; message: string }
> {
  if (isSaasMode()) {
    return {
      ok: false,
      status: 403,
      message: "GitHub App instance setup is only available in self-hosted mode."
    };
  }
  const allowed = await canAccessGithubAppSetup();
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      message: "GitHub App is already configured. Platform admin access required to change it."
    };
  }
  return { ok: true };
}

export async function setManifestStateCookie(state: string): Promise<void> {
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_MAX_AGE,
    path: "/"
  });
}

export async function consumeManifestStateCookie(
  incomingState: string | null
): Promise<boolean> {
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  return Boolean(
    incomingState && expected && incomingState.length > 0 && incomingState === expected
  );
}

export async function setDraftCredentialsCookie(signed: string): Promise<void> {
  const jar = await cookies();
  jar.set(DRAFT_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DRAFT_MAX_AGE,
    path: "/"
  });
}

export async function getDraftCredentialsCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(DRAFT_COOKIE)?.value;
}

export async function clearDraftCredentialsCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(DRAFT_COOKIE);
}
