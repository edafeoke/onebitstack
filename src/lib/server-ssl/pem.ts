const PEM_CERT =
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;
const PEM_KEY =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;

export function extractPemCertificate(text: string): string | null {
  const m = text.match(PEM_CERT);
  return m ? m[0].trim() : null;
}

export function extractPemPrivateKey(text: string): string | null {
  const m = text.match(PEM_KEY);
  return m ? m[0].trim() : null;
}

export function looksLikePemCertificate(text: string): boolean {
  return PEM_CERT.test(text);
}

export function looksLikePemPrivateKey(text: string): boolean {
  return PEM_KEY.test(text);
}
