import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("health alerts module", () => {
  it("exports collectHealthAlerts", async () => {
    const mod = await import("@/lib/health/alerts");
    assert.equal(typeof mod.collectHealthAlerts, "function");
  });
});
