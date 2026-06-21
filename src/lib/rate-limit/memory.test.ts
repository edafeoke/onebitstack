import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimitBucketsForTests } from "@/lib/rate-limit/memory";

describe("checkRateLimit", () => {
  it("allows up to limit then blocks", () => {
    resetRateLimitBucketsForTests();
    const config = { limit: 2, windowMs: 60_000 };
    assert.equal(checkRateLimit("k", config).allowed, true);
    assert.equal(checkRateLimit("k", config).allowed, true);
    const blocked = checkRateLimit("k", config);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.ok(blocked.retryAfterMs > 0);
    }
  });
});
