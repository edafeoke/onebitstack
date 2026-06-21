import { createPrivateKey, createSign } from "node:crypto";

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function encodeJson(obj: object): string {
  return base64url(Buffer.from(JSON.stringify(obj), "utf8"));
}

/** Normalize PEM from env (often uses literal `\n`). */
export function normalizeGithubAppPrivateKey(pem: string): string {
  return pem.trim().replace(/\\n/g, "\n");
}

/**
 * GitHub App JWT (RS256), valid up to 10 minutes per GitHub docs.
 * @see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 */
export function createGithubAppJwt(appId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId
  };
  const data = `${encodeJson(header)}.${encodeJson(payload)}`;
  const key = createPrivateKey(normalizeGithubAppPrivateKey(privateKeyPem));
  const sign = createSign("RSA-SHA256");
  sign.update(data);
  sign.end();
  const sig = sign.sign(key);
  return `${data}.${base64url(sig)}`;
}
