/**
 * Prepare pasted or decrypted PEM for ssh2 (strict BEGIN/END matching).
 */
export function normalizePrivateKeyPem(raw: string): string {
  let s = raw.replace(/^\uFEFF/, "").trim();

  // Literal "\n" from JSON / some paste tools
  if (s.includes("\\n") && !s.includes("\n")) {
    s = s.replace(/\\n/g, "\n");
  }

  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Unicode line/paragraph separators sometimes appear in rich-text pastes
  s = s.replace(/\u2028/g, "\n").replace(/\u2029/g, "\n");

  // Strip wrapping quotes
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
    if (s.includes("\\n") && !s.includes("\n")) {
      s = s.replace(/\\n/g, "\n");
    }
  }

  // Drop accidental prose before first PEM line
  const beginIdx = s.search(/-----BEGIN [A-Z0-9 ]+PRIVATE KEY-----/);
  if (beginIdx > 0) {
    s = s.slice(beginIdx).trimStart();
  }

  // Trim anything after the closing PEM line (common paste issue)
  const endMarkers = [
    "-----END OPENSSH PRIVATE KEY-----",
    "-----END RSA PRIVATE KEY-----",
    "-----END EC PRIVATE KEY-----",
    "-----END PRIVATE KEY-----",
    "-----END ENCRYPTED PRIVATE KEY-----"
  ];
  for (const marker of endMarkers) {
    const i = s.indexOf(marker);
    if (i !== -1) {
      s = s.slice(0, i + marker.length).trim();
      break;
    }
  }

  return s.trim();
}
