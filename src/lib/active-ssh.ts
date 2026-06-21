import type { Client } from "ssh2";

const clientsByDeploymentId = new Map<string, Client>();

export function registerSshClient(deploymentId: string, conn: Client): void {
  clientsByDeploymentId.set(deploymentId, conn);
}

export function unregisterSshClient(deploymentId: string): void {
  clientsByDeploymentId.delete(deploymentId);
}

/** End SSH session for a deployment (used when user cancels while running). */
export function endSshForDeployment(deploymentId: string): boolean {
  const conn = clientsByDeploymentId.get(deploymentId);
  if (!conn) return false;
  try {
    conn.end();
  } catch {
    /* ignore */
  }
  clientsByDeploymentId.delete(deploymentId);
  return true;
}
