/** Fields safe to return from HTTP APIs (never include SSH ciphertext). */
export const SERVER_PUBLIC_SELECT = {
  id: true,
  name: true,
  host: true,
  sshUser: true,
  webStack: true,
  reverseProxyNotes: true,
  tlsCertPath: true,
  tlsKeyPath: true,
  reverseProxyConfigPath: true,
  deployRoot: true,
  organizationId: true,
  createdAt: true,
  agentStatus: true,
  agentVersion: true,
  lastAgentHeartbeatAt: true
} as const;
