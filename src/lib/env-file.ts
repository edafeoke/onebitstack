import fs from "node:fs/promises";
import path from "node:path";

/** Keys the setup wizard may write to .env on the control plane host. */
export const WRITABLE_ENV_KEYS = new Set([
  "NEXT_PUBLIC_APP_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "ENCRYPTION_KEY",
  "CENTRAL_EDITION",
  "CENTRAL_DATABASE_PROVIDER",
  "DATABASE_URL",
  "REDIS_URL",
  "DEPLOYMENT_MODE",
  "ENABLE_CREDENTIAL_AUTH",
  "GITHUB_APP_ID",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_WEBHOOK_SECRET",
  "GITHUB_APP_SLUG",
  "NEXT_PUBLIC_GITHUB_APP_SLUG",
  "GITHUB_PRIVATE_KEY",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET"
]);

export function resolveEnvFilePath(): string {
  return path.join(process.cwd(), ".env");
}

function escapeEnvValue(value: string): string {
  if (/[\s#"\\]/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

export async function upsertEnvFile(entries: Record<string, string>): Promise<void> {
  for (const key of Object.keys(entries)) {
    if (!WRITABLE_ENV_KEYS.has(key)) {
      throw new Error(`Env key not allowed: ${key}`);
    }
  }

  const envPath = resolveEnvFilePath();
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf8");
  } catch {
    content = "";
  }

  for (const [key, rawValue] of Object.entries(entries)) {
    const value = escapeEnvValue(rawValue.trim());
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      if (content.length > 0 && !content.endsWith("\n")) content += "\n";
      content += `${line}\n`;
    }
  }

  await fs.writeFile(envPath, content, { encoding: "utf8", mode: 0o600 });
}

export async function envFileExists(): Promise<boolean> {
  try {
    await fs.access(resolveEnvFilePath());
    return true;
  } catch {
    return false;
  }
}
