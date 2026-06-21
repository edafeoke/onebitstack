import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dashboardEmbedNginxLines,
  resolveDashboardFrameAncestors
} from "@/lib/deployment/templates/nginx-common";

describe("resolveDashboardFrameAncestors", () => {
  it("includes dashboard origin and apex wildcard from BETTER_AUTH_URL", () => {
    const prev = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = "https://app.centralstackhq.com";
    try {
      const ancestors = resolveDashboardFrameAncestors();
      assert.ok(ancestors.includes("https://app.centralstackhq.com"));
      assert.ok(ancestors.includes("https://*.centralstackhq.com"));
    } finally {
      if (prev === undefined) delete process.env.BETTER_AUTH_URL;
      else process.env.BETTER_AUTH_URL = prev;
    }
  });
});

describe("dashboardEmbedNginxLines", () => {
  it("emits frame-ancestors when origins configured", () => {
    const prev = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = "https://centralstackhq.com";
    try {
      const lines = dashboardEmbedNginxLines();
      assert.match(lines.join("\n"), /frame-ancestors/);
      assert.doesNotMatch(lines.join("\n"), /X-Frame-Options/);
    } finally {
      if (prev === undefined) delete process.env.BETTER_AUTH_URL;
      else process.env.BETTER_AUTH_URL = prev;
    }
  });
});
