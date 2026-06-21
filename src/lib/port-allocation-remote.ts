import type { DeployTarget } from "@/lib/deploy/types";
import { withSshSession } from "@/lib/deploy/ssh-session";

/**
 * Parse listening TCP ports from `ss -tlnH` (Linux).
 * Falls back to empty set when the command is unavailable.
 */
export async function listRemoteListenPorts(target: DeployTarget): Promise<Set<number>> {
  const ports = new Set<number>();
  try {
    await withSshSession(target, undefined, undefined, async (ssh) => {
      const script = [
        "set +e",
        "if command -v ss >/dev/null 2>&1; then",
        "  ss -tlnH 2>/dev/null | awk '{print $4}' | sed -E 's/.*:([0-9]+)$/\\1/'",
        "elif command -v netstat >/dev/null 2>&1; then",
        "  netstat -tln 2>/dev/null | awk 'NR>2 {print $4}' | sed -E 's/.*:([0-9]+)$/\\1/'",
        "fi"
      ].join("\n");
      const out = await ssh.execCapture(script);
      for (const line of out.split("\n")) {
        const p = Number(line.trim());
        if (Number.isInteger(p) && p > 0 && p <= 65_535) ports.add(p);
      }
    });
  } catch {
    // Remote scan is best-effort; DB allocation still applies.
  }
  return ports;
}
