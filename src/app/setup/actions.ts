"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isCredentialAuthEnabled, withProductionAuthUrls } from "@/lib/auth-config";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { upsertEnvFile } from "@/lib/env-file";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/require-session";
import { checkDatabase } from "@/lib/setup-checks";
import {
  canWriteEnvDuringSetup,
  readGithubDraftFromCookie
} from "@/lib/setup-env-access";
import { isSetupCompleted, markSetupCompleted } from "@/lib/setup-state";

const adminSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export type SetupActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createSetupAdmin(
  _prev: SetupActionResult | null,
  formData: FormData
): Promise<SetupActionResult> {
  if (!isCredentialAuthEnabled()) {
    return { ok: false, error: "Email/password auth is disabled. Use GitHub sign-in or enable ENABLE_CREDENTIAL_AUTH." };
  }

  const completed = await isSetupCompleted();
  const session = await getSession();
  if (completed) {
    if (!session?.user || !(await isPlatformAdmin(session.user.id))) {
      return { ok: false, error: "Setup is already complete. Sign in as a platform admin to run repair checks." };
    }
    return { ok: true };
  }

  const adminCount = await prisma.user.count({ where: { role: "admin" } });
  if (adminCount > 0) {
    return { ok: false, error: "A platform admin already exists. Sign in instead." };
  }

  const parsed = adminSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid name, email, or password (min 8 characters)." };
  }

  const db = await checkDatabase();
  if (!db.ok) {
    return { ok: false, error: `Database not ready: ${db.message}` };
  }

  const { name, email, password } = parsed.data;

  try {
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers()
    });

    const userId = result.user?.id;
    if (!userId) {
      return { ok: false, error: "Account created but user id missing." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: "admin" }
    });

    await markSetupCompleted(userId, process.env.npm_package_version);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create admin account";
    return { ok: false, error: msg };
  }
}

const publicUrlSchema = z.object({
  publicUrl: z.string().url()
});

export async function saveSetupPublicUrl(
  _prev: SetupActionResult | null,
  formData: FormData
): Promise<SetupActionResult> {
  const access = await canWriteEnvDuringSetup();
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = publicUrlSchema.safeParse({
    publicUrl: formData.get("publicUrl")
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid public URL (https://…)." };
  }

  const origin = parsed.data.publicUrl.replace(/\/+$/, "");
  const entries = withProductionAuthUrls(
    {
      NEXT_PUBLIC_APP_URL: origin,
      BETTER_AUTH_URL: origin,
      CENTRAL_EDITION: "control_plane",
      DEPLOYMENT_MODE: "self_hosted"
    },
    origin
  );

  try {
    await upsertEnvFile(entries);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not write .env"
    };
  }
}

export async function applyGithubDraftToEnv(): Promise<SetupActionResult> {
  const access = await canWriteEnvDuringSetup();
  if (!access.ok) return { ok: false, error: access.error };

  const draft = await readGithubDraftFromCookie();
  if (!draft?.appId || !draft.privateKey) {
    return { ok: false, error: "No GitHub App draft found. Save credentials in the panel first." };
  }

  const pem = draft.privateKey.replace(/\n/g, "\\n");
  try {
    await upsertEnvFile({
      GITHUB_APP_ID: draft.appId,
      GITHUB_APP_CLIENT_ID: draft.clientId,
      GITHUB_APP_CLIENT_SECRET: draft.clientSecret,
      GITHUB_APP_WEBHOOK_SECRET: draft.webhookSecret,
      GITHUB_APP_SLUG: draft.appSlug,
      NEXT_PUBLIC_GITHUB_APP_SLUG: draft.appSlug,
      GITHUB_PRIVATE_KEY: pem,
      GITHUB_CLIENT_ID: draft.clientId,
      GITHUB_CLIENT_SECRET: draft.clientSecret
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not write .env"
    };
  }
}
