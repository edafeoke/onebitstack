import { repoSlugFromRepository } from "@/lib/deploy/work-tree";

function bashSingleQuoted(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

export function interpolateDeployTemplates(
  cmd: string,
  repository: string,
  workTree: string,
  projectSlug?: string
): string {
  const slug = projectSlug ?? repoSlugFromRepository(repository);
  return cmd
    .replaceAll("{projectSlug}", slug)
    .replaceAll("{repoSlug}", slug)
    .replaceAll("{repo}", slug)
    .replaceAll("{workTree}", bashSingleQuoted(workTree));
}
