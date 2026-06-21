import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { syncGithubInstallationsForUser } from "@/lib/github-app/list-installations";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncGithubInstallationsForUser(session.user.id);
  if (result.error) {
    return Response.json(
      { ok: false, synced: result.synced, message: result.error },
      { status: 400 }
    );
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/projects/new");
  return Response.json({ ok: true, synced: result.synced });
}
