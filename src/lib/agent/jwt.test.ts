import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { signAgentJwt, verifyAgentJwt } from "@/lib/agent/jwt";

describe("agent JWT", () => {
  const prev = process.env.AGENT_JWT_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.AGENT_JWT_SECRET;
    else process.env.AGENT_JWT_SECRET = prev;
  });

  it("signs and verifies agent token", () => {
    process.env.AGENT_JWT_SECRET = "test-agent-jwt-secret-min-32-characters-long";
    const token = signAgentJwt({ sub: "agent_abc", serverId: "srv_1" }, 3600);
    const payload = verifyAgentJwt(token);
    assert.ok(payload);
    assert.equal(payload?.sub, "agent_abc");
    assert.equal(payload?.serverId, "srv_1");
    assert.equal(payload?.typ, "agent");
  });

  it("rejects tampered token", () => {
    process.env.AGENT_JWT_SECRET = "test-agent-jwt-secret-min-32-characters-long";
    const token = signAgentJwt({ sub: "agent_abc", serverId: "srv_1" }, 3600);
    const bad = token.slice(0, -1) + "x";
    assert.equal(verifyAgentJwt(bad), null);
  });
});
