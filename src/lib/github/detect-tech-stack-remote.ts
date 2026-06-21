import { inferStackFromRootFiles } from "@/lib/github/detect-tech-stack";
import { withDeployPipeline, type StackWithPipeline } from "@/lib/github/pipeline";
import {
  getFileContentIfExists,
  withInstallationToken
} from "@/lib/github/github-rest";

export async function detectTechStackRemote(input: {
  fullName: string;
  branch: string;
  installationId: string;
}): Promise<StackWithPipeline> {
  const [owner, ...rest] = input.fullName.split("/");
  const repo = rest.join("/");
  if (!owner || !repo) {
    throw new Error("Invalid fullName; expected owner/repo");
  }
  const ref = input.branch;

  return withInstallationToken(input.installationId, async (token) => {
    const [
      packageJson,
      composerJson,
      indexHtml,
      requirementsTxt,
      pyprojectToml,
      dockerfile,
      goMod,
      artisan,
      nextConfigTs,
      nextConfigJs,
      nextConfigMjs
    ] = await Promise.all([
      getFileContentIfExists(token, owner, repo, "package.json", ref),
      getFileContentIfExists(token, owner, repo, "composer.json", ref),
      getFileContentIfExists(token, owner, repo, "index.html", ref),
      getFileContentIfExists(token, owner, repo, "requirements.txt", ref),
      getFileContentIfExists(token, owner, repo, "pyproject.toml", ref),
      getFileContentIfExists(token, owner, repo, "Dockerfile", ref),
      getFileContentIfExists(token, owner, repo, "go.mod", ref),
      getFileContentIfExists(token, owner, repo, "artisan", ref),
      getFileContentIfExists(token, owner, repo, "next.config.ts", ref),
      getFileContentIfExists(token, owner, repo, "next.config.js", ref),
      getFileContentIfExists(token, owner, repo, "next.config.mjs", ref)
    ]);

    const stack = inferStackFromRootFiles({
      packageJson,
      composerJson,
      indexHtml,
      requirementsTxt,
      pyprojectToml,
      dockerfile,
      goMod,
      artisan,
      nextConfig: nextConfigTs ?? nextConfigJs ?? nextConfigMjs
    });
    return withDeployPipeline(stack);
  });
}
