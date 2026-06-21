export type ProjectPublicUrl = {
  href: string;
  label: string;
  kind: "domain" | "host";
};

export function resolveProjectHostname(input: {
  domain?: string | null;
  domains?: { hostname: string; isPrimary: boolean }[];
}): string | null {
  const fromProject = input.domain?.trim();
  if (fromProject) return fromProject;

  const list = input.domains ?? [];
  const primary = list.find((d) => d.isPrimary);
  if (primary?.hostname.trim()) return primary.hostname.trim();
  const first = list[0]?.hostname?.trim();
  return first || null;
}

/** Public URL for a successfully deployed project, or null if none can be built. */
export function resolveProjectPublicUrl(input: {
  domain?: string | null;
  domains?: { hostname: string; isPrimary: boolean }[];
  serverHost: string;
  port?: number | null;
  webServer?: string | null;
}): ProjectPublicUrl | null {
  const hostname = resolveProjectHostname(input);
  if (hostname) {
    return { href: `https://${hostname}`, label: hostname, kind: "domain" };
  }

  const hasProxy = input.webServer === "nginx" || input.webServer === "apache";
  if (hasProxy && input.port != null) {
    const label = `${input.serverHost}:${input.port}`;
    return { href: `http://${label}`, label, kind: "host" };
  }

  return null;
}
