import type { DeployTarget } from "@/lib/deploy/types";
import { withSshSession } from "@/lib/deploy/ssh-session";
import { buildNginxHostnamePreflightScript } from "@/lib/nginx/install";

function bashQ(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

export async function runRemoteNginxHostnamePreflight(input: {
  target: DeployTarget;
  slug: string;
  hostnames: string[];
  deploymentId?: string;
  onLog?: (line: string) => Promise<void>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const publicHosts = input.hostnames.filter((h) => !h.endsWith(".local"));
  if (publicHosts.length === 0) {
    return { ok: true };
  }

  const script = buildNginxHostnamePreflightScript({
    slug: input.slug,
    hostnames: publicHosts
  });

  try {
    await withSshSession(
      input.target,
      undefined,
      { deploymentId: input.deploymentId },
      async (ssh) => {
        const out = await ssh.execCapture(`bash -lc ${bashQ(script)}`);
        if (out.trim()) await input.onLog?.(`[nginx] ${out.trim()}`);
      }
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: msg.includes("conflict")
        ? msg
        : `Nginx hostname preflight failed: ${msg}`
    };
  }
}
