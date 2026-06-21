/** Repo directory name from `owner/repo` or plain slug. */
export function repoSlugFromRepository(repository: string): string {
  const r = repository.trim();
  return r.includes("/") ? r.split("/").pop()! : r;
}

/**
 * Directory on the VPS where git clone / build / PM2 run.
 * If deployment path already ends with the repo slug, use it as-is; else append slug.
 */
export function resolveRemoteWorkTree(deploymentPath: string, repository: string): string {
  const root = deploymentPath.replace(/\/+$/, "") || "/";
  const repoSlug = repoSlugFromRepository(repository);
  const segments = root.split("/").filter(Boolean);
  const baseName = segments.length ? segments[segments.length - 1]! : "";
  return baseName === repoSlug ? root : `${root}/${repoSlug}`;
}
