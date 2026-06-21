/** Join non-empty lines with newlines (no trailing newline unless last line empty). */
export function joinLines(lines: (string | undefined | false)[]): string {
  return lines.filter((l): l is string => Boolean(l)).join("\n");
}

export function indent(spaces: number, text: string): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => (l.length ? pad + l : l))
    .join("\n");
}

export function block(name: string, inner: string, spaces = 0): string {
  const body = inner.trimEnd();
  return joinLines([`${name} {`, indent(2, body), "}"]);
}
