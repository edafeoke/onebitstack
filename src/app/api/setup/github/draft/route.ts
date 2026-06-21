import { NextResponse } from "next/server";
import { z } from "zod";
import { encodeSignedJson, generateWebhookSecret } from "@/lib/github-app/setup";
import {
  requireGithubAppSetupAccess,
  setDraftCredentialsCookie
} from "@/lib/github-app/setup-auth";

const schema = z.object({
  appId: z.string().min(1),
  privateKey: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  webhookSecret: z.string().optional(),
  appSlug: z.string().optional()
});

export async function POST(request: Request): Promise<Response> {
  const access = await requireGithubAppSetupAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials payload." }, { status: 400 });
  }

  const draft = {
    ...parsed.data,
    webhookSecret: parsed.data.webhookSecret?.trim() || generateWebhookSecret(),
    appSlug: parsed.data.appSlug?.trim() ?? ""
  };

  await setDraftCredentialsCookie(encodeSignedJson(draft));
  return NextResponse.json({ ok: true });
}
