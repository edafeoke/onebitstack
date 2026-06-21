/** Branches commonly used as production defaults when configuring projects. */
export const COMMON_PRODUCTION_BRANCHES = ["main", "master"] as const;

export type ParsedPushRef =
  | { ok: true; branch: string }
  | { ok: false; reason: string };

export function parseGithubPushRef(ref: unknown): ParsedPushRef {
  if (typeof ref !== "string" || !ref.startsWith("refs/heads/")) {
    return { ok: false, reason: "not_a_branch_ref" };
  }
  const branch = ref.slice("refs/heads/".length).trim();
  if (!branch.length) {
    return { ok: false, reason: "empty_branch" };
  }
  return { ok: true, branch };
}

export function extractPushCommitSha(payload: Record<string, unknown>): string | null {
  const head = payload.head_commit;
  if (typeof head === "object" && head !== null && !Array.isArray(head)) {
    const id = (head as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  const after = payload.after;
  if (typeof after === "string" && after.length > 0 && after !== "0000000000000000000000000000000000000000") {
    return after;
  }
  return null;
}

export function extractInstallationId(payload: Record<string, unknown>): string | null {
  const installation = payload.installation;
  if (typeof installation !== "object" || installation === null || Array.isArray(installation)) {
    return null;
  }
  const id = (installation as { id?: unknown }).id;
  if (typeof id === "number") return String(id);
  if (typeof id === "string" && id.length > 0) return id;
  return null;
}

export function repositoryFullName(payload: Record<string, unknown>): string | null {
  const repo = payload.repository;
  if (typeof repo !== "object" || repo === null || Array.isArray(repo)) return null;
  const fullName = (repo as { full_name?: unknown }).full_name;
  return typeof fullName === "string" && fullName.length > 0 ? fullName : null;
}
