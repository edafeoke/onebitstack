export type DeployStreamHandlers = {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

export type DeployTarget = {
  serverIp: string;
  sshUser: string;
  sshPrivateKey: string;
  deploymentPath: string;
  /** VPS root for apps, configs, data, logs (server setting). */
  deployRoot: string;
  buildCommand: string;
  restartCommand: string;
  startCommand?: string;
};

export type DeployConnectionOptions = {
  deploymentId?: string;
};
