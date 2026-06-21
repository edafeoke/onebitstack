import { createHash, randomBytes } from "node:crypto";

export function hashAgentSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generatePairingToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateAgentId(): string {
  return `agent_${randomBytes(12).toString("hex")}`;
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }
  return diff === 0;
}
