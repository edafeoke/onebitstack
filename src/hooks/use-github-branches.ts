"use client";

import { useQuery } from "@tanstack/react-query";
import { messageFromApiBody } from "@/lib/api-response";

export type GithubBranch = { name: string; protected: boolean };

async function fetchBranches(
  repository: string,
  installationId: string
): Promise<GithubBranch[]> {
  const [owner, ...rest] = repository.split("/");
  const repo = rest.join("/");
  if (!owner || !repo) return [];

  const res = await fetch(
    `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?installationId=${encodeURIComponent(installationId)}`,
    { credentials: "include" }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(messageFromApiBody(body, `Failed to load branches (${res.status})`));
  }
  return body as GithubBranch[];
}

export function useGithubBranches(
  repository: string,
  installationId: string | null
) {
  return useQuery({
    queryKey: ["github-branches", repository, installationId],
    queryFn: () => fetchBranches(repository, installationId!),
    enabled: Boolean(installationId && repository.includes("/")),
    staleTime: 60_000
  });
}
