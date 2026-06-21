import { createHmac, timingSafeEqual } from "node:crypto";

export type AgentJwtPayload = {
  sub: string;
  serverId: string;
  typ: "agent";
  exp: number;
};

function agentJwtSecret(): string {
  const s =
    process.env.AGENT_JWT_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "";
  if (s.length < 32) {
    throw new Error("AGENT_JWT_SECRET (or BETTER_AUTH_SECRET) must be at least 32 characters.");
  }
  return s;
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, "utf8").toString("base64url");
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

export function signAgentJwt(payload: Omit<AgentJwtPayload, "typ" | "exp">, ttlSec: number): string {
  const full: AgentJwtPayload = {
    ...payload,
    typ: "agent",
    exp: Math.floor(Date.now() / 1000) + ttlSec
  };
  const body = base64UrlEncode(JSON.stringify(full));
  const sig = createHmac("sha256", agentJwtSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyAgentJwt(token: string): AgentJwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac("sha256", agentJwtSecret()).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  let payload: AgentJwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(body)) as AgentJwtPayload;
  } catch {
    return null;
  }
  if (payload.typ !== "agent") return null;
  if (typeof payload.sub !== "string" || typeof payload.serverId !== "string") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** 90-day agent access token after pairing. */
export const AGENT_JWT_TTL_SEC = 90 * 24 * 60 * 60;
