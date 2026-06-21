import { NextResponse } from "next/server";
import { generateWebhookSecret } from "@/lib/github-app/setup";
import { requireGithubAppSetupAccess } from "@/lib/github-app/setup-auth";

export async function POST(): Promise<Response> {
  const access = await requireGithubAppSetupAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }
  return NextResponse.json({ secret: generateWebhookSecret() });
}
