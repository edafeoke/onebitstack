import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isRedisQueueEnabled, resolveRedisUrl } from "@/lib/queue/redis";
import { serverDeployLockKey } from "@/lib/queue/deploy-lock";

describe("isRedisQueueEnabled", () => {
  const prev = process.env.REDIS_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prev;
  });

  it("is false when REDIS_URL unset", () => {
    delete process.env.REDIS_URL;
    assert.equal(isRedisQueueEnabled(), false);
  });

  it("is true when REDIS_URL set", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    assert.equal(isRedisQueueEnabled(), true);
  });
});

describe("resolveRedisUrl", () => {
  const prev = process.env.REDIS_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prev;
  });

  it("defaults to local redis", () => {
    delete process.env.REDIS_URL;
    assert.equal(resolveRedisUrl(), "redis://127.0.0.1:6379");
  });
});

describe("serverDeployLockKey", () => {
  it("scopes by server id", () => {
    assert.equal(serverDeployLockKey("srv_1"), "central:deploy:lock:srv_1");
  });
});
