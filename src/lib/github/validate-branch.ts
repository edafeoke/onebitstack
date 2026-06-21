import { listBranches } from "@/lib/github/github-rest";
import { getInstallationAccessToken } from "@/lib/github-app/installation-token";

export function parseRepositoryFullName(fullName: string): { owner: string; repo: string } | null {
  const [owner, ...rest] = fullName.split("/");
  const repo = rest.join("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

export async function validateGithubBranchExists(input: {
  installationId: string;
  repository: string;
  branch: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = parseRepositoryFullName(input.repository);
  if (!parsed) {
    return { ok: false, message: "Invalid repository name." };
  }
  const branch = input.branch.trim();
  if (!branch) {
    return { ok: false, message: "Branch name is required." };
  }
  try {
    const token = await getInstallationAccessToken(input.installationId);
    const branches = await listBranches(token, parsed.owner, parsed.repo);
    if (!branches.some((b) => b.name === branch)) {
      return {
        ok: false,
        message: `Branch "${branch}" was not found on GitHub. Choose another branch.`
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Could not verify branch on GitHub: ${msg}` };
  }
}
