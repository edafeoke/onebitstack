import type { EnvScope, ProjectEnvVar } from "@/generated/prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/** Map deployment environment slug to env var scope. */
export function envScopeForEnvironmentSlug(slug: string): EnvScope {
  const s = slug.toLowerCase();
  if (s === "preview" || s === "staging") return "preview";
  if (s === "development" || s === "dev") return "development";
  return "production";
}

export function resolveEnvVarValue(row: ProjectEnvVar): string {
  if (row.isSecret && row.valueCipher && row.valueIv && row.valueTag) {
    return decryptSecret({
      cipherTextB64: row.valueCipher,
      ivB64: row.valueIv,
      authTagB64: row.valueTag
    });
  }
  return row.value;
}

export function envRecordForScope(
  vars: ProjectEnvVar[],
  scope: EnvScope
): Record<string, string> {
  const o: Record<string, string> = {};
  for (const v of vars) {
    if (v.scope !== scope) continue;
    o[v.key] = resolveEnvVarValue(v);
  }
  return o;
}

export function envRecordForEnvironment(
  vars: ProjectEnvVar[],
  environmentSlug: string
): Record<string, string> {
  return envRecordForScope(vars, envScopeForEnvironmentSlug(environmentSlug));
}

export type EnvVarInput = {
  key: string;
  value: string;
  scope: EnvScope;
  isSecret: boolean;
};

export function serializeEnvVarForDb(row: EnvVarInput): {
  key: string;
  value: string;
  scope: EnvScope;
  isSecret: boolean;
  valueCipher: string;
  valueIv: string;
  valueTag: string;
} {
  if (row.isSecret) {
    const enc = encryptSecret(row.value);
    return {
      key: row.key.trim(),
      scope: row.scope,
      isSecret: true,
      value: "",
      valueCipher: enc.cipherTextB64,
      valueIv: enc.ivB64,
      valueTag: enc.authTagB64
    };
  }
  return {
    key: row.key.trim(),
    scope: row.scope,
    isSecret: false,
    value: row.value,
    valueCipher: "",
    valueIv: "",
    valueTag: ""
  };
}

/** Client-safe shape (secrets never send plaintext from server on load). */
export type EnvVarClientRow = {
  key: string;
  value: string;
  scope: EnvScope;
  isSecret: boolean;
  hasSecret: boolean;
};

export function toEnvVarClientRow(row: ProjectEnvVar): EnvVarClientRow {
  return {
    key: row.key,
    value: row.isSecret ? "" : row.value,
    scope: row.scope,
    isSecret: row.isSecret,
    hasSecret: row.isSecret && Boolean(row.valueCipher)
  };
}

export function formatEnvFileFromRows(rows: EnvVarClientRow[]): string {
  const lines = rows
    .filter((r) => r.key.trim())
    .map((r) => {
      const val = r.value;
      if (/[\s#"'\\]/.test(val)) {
        return `${r.key}="${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      }
      return `${r.key}=${val}`;
    });
  return `${lines.join("\n")}\n`;
}
