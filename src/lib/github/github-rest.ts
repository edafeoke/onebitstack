import { getInstallationAccessToken } from "@/lib/github-app/installation-token";

type RepoRow = {
  id: number;
  full_name: string;
  default_branch: string;
  private: boolean;
};

async function fetchJson(
  url: string,
  token: string
): Promise<{ body: unknown; nextUrl: string | null }> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub API ${res.status}: ${t.slice(0, 400)}`);
  }
  const link = res.headers.get("link");
  let nextUrl: string | null = null;
  if (link) {
    const parts = link.split(",");
    for (const p of parts) {
      const m = p.match(/<([^>]+)>;\s*rel="next"/);
      if (m?.[1]) nextUrl = m[1];
    }
  }
  return { body: await res.json(), nextUrl };
}

export async function listInstallationRepositories(
  installationAccessToken: string
): Promise<RepoRow[]> {
  const out: RepoRow[] = [];
  let url: string | null =
    "https://api.github.com/installation/repositories?per_page=100";
  while (url) {
    const { body, nextUrl } = await fetchJson(url, installationAccessToken);
    const rec = body as { repositories?: RepoRow[] };
    const repos = Array.isArray(rec.repositories) ? rec.repositories : [];
    for (const r of repos) {
      if (typeof r.full_name === "string") {
        out.push({
          id: typeof r.id === "number" ? r.id : 0,
          full_name: r.full_name,
          default_branch: typeof r.default_branch === "string" ? r.default_branch : "main",
          private: Boolean(r.private)
        });
      }
    }
    url = nextUrl;
  }
  return out;
}

export async function listBranches(
  installationAccessToken: string,
  owner: string,
  repo: string
): Promise<{ name: string; protected: boolean }[]> {
  const out: { name: string; protected: boolean }[] = [];
  let page = 1;
  for (;;) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${installationAccessToken}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GitHub branches ${res.status}: ${t.slice(0, 400)}`);
    }
    const rows = (await res.json()) as { name?: string; protected?: boolean }[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const b of rows) {
      if (typeof b.name === "string") {
        out.push({ name: b.name, protected: Boolean(b.protected) });
      }
    }
    if (rows.length < 100) break;
    page += 1;
  }
  return out;
}

export async function getFileContentIfExists(
  installationAccessToken: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${installationAccessToken}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub contents ${res.status}: ${t.slice(0, 400)}`);
  }
  const body = (await res.json()) as { content?: string; encoding?: string };
  if (body.encoding !== "base64" || typeof body.content !== "string") {
    return null;
  }
  return Buffer.from(body.content.replace(/\s/g, ""), "base64").toString("utf8");
}

export async function withInstallationToken<T>(
  installationId: string,
  fn: (token: string) => Promise<T>
): Promise<T> {
  const token = await getInstallationAccessToken(installationId);
  return fn(token);
}
