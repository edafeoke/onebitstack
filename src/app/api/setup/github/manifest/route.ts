import { NextResponse } from "next/server";
import { generateManifestState } from "@/lib/github-app/setup";
import { requireGithubAppSetupAccess, setManifestStateCookie } from "@/lib/github-app/setup-auth";

export async function GET(): Promise<Response> {
  const access = await requireGithubAppSetupAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const state = generateManifestState();
  await setManifestStateCookie(state);

  const url = new URL("/setup/github/create", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  return NextResponse.redirect(url);
}
