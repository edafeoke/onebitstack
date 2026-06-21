import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GithubManifestSubmit } from "@/components/github-manifest-submit";
import {
  buildGithubManifestCreateUrl,
  resolvePublicBaseUrl
} from "@/lib/github-app/setup";
import { canAccessGithubAppSetup } from "@/lib/github-app/setup-auth";

export default async function GithubManifestCreatePage() {
  if (!(await canAccessGithubAppSetup())) {
    redirect("/setup");
  }

  const jar = await cookies();
  const state = jar.get("central_github_manifest_state")?.value;
  if (!state) {
    redirect("/api/setup/github/manifest");
  }

  const baseUrl = resolvePublicBaseUrl();
  const { formAction, manifestJson } = buildGithubManifestCreateUrl(baseUrl, state);

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Redirecting to GitHub…</h1>
      <p className="text-muted-foreground text-sm">
        Register your GitHub App with pre-filled webhook and OAuth settings.
      </p>
      <GithubManifestSubmit formAction={formAction} manifestJson={manifestJson} />
    </main>
  );
}
