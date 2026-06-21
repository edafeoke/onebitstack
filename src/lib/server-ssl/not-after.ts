/** Parse openssl `notAfter=Mon Jan  1 12:00:00 2025 GMT` to Date. */
export function parseOpenSslNotAfter(line: string): Date | null {
  const raw = line.replace(/^notAfter=/, "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseOpenSslOutput(output: string): Date | null {
  for (const line of output.split("\n")) {
    if (line.startsWith("notAfter=")) {
      return parseOpenSslNotAfter(line);
    }
  }
  return null;
}
