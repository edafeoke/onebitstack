import { NextResponse } from "next/server";
import { z } from "zod";
import {
  decodeSignedJson,
  draftToCredentials,
  getGithubAppConfig,
  verifyGithubAppCredentials,
  type GithubAppDraftCredentials
} from "@/lib/github-app/setup";
import {
  getDraftCredentialsCookie,
  requireGithubAppSetupAccess
} from "@/lib/github-app/setup-auth";

const bodySchema = z
  .object({
    appId: z.string().optional(),
    privateKey: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    webhookSecret: z.string().optional(),
    appSlug: z.string().optional(),
    useDraft: z.boolean().optional()
  })
  .optional();

export async function POST(request: Request): Promise<Response> {
  const access = await requireGithubAppSetupAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  let body: z.infer<typeof bodySchema> = undefined;
  try {
    const json = await request.json();
    body = bodySchema.parse(json);
  } catch {
    body = undefined;
  }

  let creds = getGithubAppConfig();

  if (body?.useDraft || body?.appId) {
    const draftFromBody: Partial<GithubAppDraftCredentials> = {
      appId: body?.appId,
      privateKey: body?.privateKey,
      clientId: body?.clientId,
      clientSecret: body?.clientSecret,
      webhookSecret: body?.webhookSecret,
      appSlug: body?.appSlug
    };

    const signed = await getDraftCredentialsCookie();
    const fromCookie = signed ? decodeSignedJson<GithubAppDraftCredentials>(signed) : null;

    const merged: GithubAppDraftCredentials = {
      appId: draftFromBody.appId ?? fromCookie?.appId ?? "",
      privateKey: draftFromBody.privateKey ?? fromCookie?.privateKey ?? "",
      clientId: draftFromBody.clientId ?? fromCookie?.clientId ?? "",
      clientSecret: draftFromBody.clientSecret ?? fromCookie?.clientSecret ?? "",
      webhookSecret: draftFromBody.webhookSecret ?? fromCookie?.webhookSecret ?? "",
      appSlug: draftFromBody.appSlug ?? fromCookie?.appSlug ?? ""
    };

    if (!merged.appId || !merged.privateKey || !merged.clientId || !merged.clientSecret) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields (app id, PEM, client id/secret)." },
        { status: 400 }
      );
    }

    creds = draftToCredentials(merged);
  }

  if (!creds) {
    return NextResponse.json(
      { ok: false, error: "No GitHub App credentials in environment or draft." },
      { status: 400 }
    );
  }

  const result = await verifyGithubAppCredentials(creds);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    slug: result.slug ?? creds.appSlug,
    name: result.name
  });
}
