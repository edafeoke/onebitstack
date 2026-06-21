/** Extract server_name tokens from generated or custom nginx config text. */
export function extractServerNamesFromNginxConfig(config: string): string[] {
  const names = new Set<string>();
  const re = /^\s*server_name\s+([^;]+);/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(config)) !== null) {
    const chunk = m[1] ?? "";
    for (const part of chunk.split(/\s+/)) {
      const t = part.trim();
      if (t && t !== "_") names.add(t.toLowerCase());
    }
  }
  return [...names];
}
