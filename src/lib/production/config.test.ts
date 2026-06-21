import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDeployQueueAvailable,
  isAgentPrimaryMode,
  requireRedisQueueInProduction
} from "@/lib/production/config";

describe("production config", () => {
  const prevNode = process.env.NODE_ENV;
  const prevRedis = process.env.REDIS_URL;
  const prevAgent = process.env.AGENT_PRIMARY;
  const prevRequire = process.env.REQUIRE_REDIS_QUEUE;

  const restore = () => {
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
    if (prevAgent === undefined) delete process.env.AGENT_PRIMARY;
    else process.env.AGENT_PRIMARY = prevAgent;
    if (prevRequire === undefined) delete process.env.REQUIRE_REDIS_QUEUE;
    else process.env.REQUIRE_REDIS_QUEUE = prevRequire;
  };

  it("isAgentPrimaryMode reads AGENT_PRIMARY", () => {
    process.env.AGENT_PRIMARY = "true";
    assert.equal(isAgentPrimaryMode(), true);
    restore();
  });

  it("requireRedisQueueInProduction defaults true in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.REQUIRE_REDIS_QUEUE;
    assert.equal(requireRedisQueueInProduction(), true);
    restore();
  });

  it("assertDeployQueueAvailable blocks production without redis", () => {
    process.env.NODE_ENV = "production";
    delete process.env.REDIS_URL;
    const res = assertDeployQueueAvailable();
    assert.equal(res.ok, false);
    restore();
  });
});
