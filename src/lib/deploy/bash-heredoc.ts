import { randomBytes } from "node:crypto";

export function bashQ(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

/** Write file contents on remote host via bash heredoc. */
export function bashWriteFile(path: string, content: string): string {
  let delim = `CENTRAL_EOF_${randomBytes(8).toString("hex")}`;
  while (content.includes(delim)) {
    delim = `CENTRAL_EOF_${randomBytes(8).toString("hex")}`;
  }
  return `cat > ${bashQ(path)} << '${delim}'\n${content}\n${delim}`;
}
