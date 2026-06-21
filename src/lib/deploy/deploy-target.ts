import { decryptSecret } from "@/lib/crypto";
import { normalizeDeployRoot } from "@/lib/server-layout";
import type { DeployTarget } from "@/lib/deploy/types";

export type ServerSshRecord = {
  host: string;
  sshUser: string;
  sshPrivateKeyCipher: string;
  sshPrivateKeyIv: string;
  sshPrivateKeyTag: string;
  deployRoot?: string | null;
};

export function buildDeployTarget(
  server: ServerSshRecord,
  deploymentPath: string,
  commands?: {
    buildCommand?: string;
    restartCommand?: string;
    startCommand?: string;
  }
): DeployTarget {
  const rawKey = decryptSecret({
    cipherTextB64: server.sshPrivateKeyCipher,
    ivB64: server.sshPrivateKeyIv,
    authTagB64: server.sshPrivateKeyTag
  });
  return {
    serverIp: server.host,
    sshUser: server.sshUser,
    sshPrivateKey: rawKey,
    deploymentPath,
    deployRoot: normalizeDeployRoot(server.deployRoot),
    buildCommand: commands?.buildCommand ?? "",
    restartCommand: commands?.restartCommand ?? "",
    startCommand: commands?.startCommand
  };
}
