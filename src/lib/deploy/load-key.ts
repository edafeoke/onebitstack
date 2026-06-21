import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { normalizePrivateKeyPem } from "@/lib/normalize-ssh-key";

export function loadPrivateKey(raw: string): Buffer {
  const trimmed = normalizePrivateKeyPem(raw);
  if (!trimmed) {
    throw new Error(
      "SSH private key is empty after normalization. Paste the full PEM (including BEGIN/END lines)."
    );
  }

  if (trimmed.includes("BEGIN") && trimmed.includes("PRIVATE KEY")) {
    return Buffer.from(trimmed, "utf8");
  }

  let keyPath = trimmed;
  if (keyPath.startsWith("~/")) {
    keyPath = resolve(homedir(), keyPath.slice(2));
  } else if (keyPath === "~") {
    keyPath = homedir();
  } else if (!isAbsolute(keyPath)) {
    keyPath = resolve(process.cwd(), keyPath);
  }

  if (!existsSync(keyPath)) {
    throw new Error(`SSH private key file not found: ${keyPath}`);
  }

  return readFileSync(keyPath);
}
