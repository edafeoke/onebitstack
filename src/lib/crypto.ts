import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function getKey32(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (k && k.length >= 32) {
    return Buffer.from(k.slice(0, 32), "utf8");
  }
  return scryptSync(
    k ?? "central-server-dev-encryption-key-change-me",
    "central-salt",
    32
  );
}

export function encryptSecret(plaintext: string): {
  cipherTextB64: string;
  ivB64: string;
  authTagB64: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey32(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ivB64: iv.toString("base64"),
    cipherTextB64: enc.toString("base64"),
    authTagB64: authTag.toString("base64")
  };
}

export function decryptSecret(parts: {
  cipherTextB64: string;
  ivB64: string;
  authTagB64: string;
}): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey32(),
    Buffer.from(parts.ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(parts.authTagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(parts.cipherTextB64, "base64")),
    decipher.final()
  ]).toString("utf8");
}
