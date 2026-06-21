import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hostnamesFromProject,
  isValidHostname,
  normalizeHostname
} from "@/lib/nginx/domains";

describe("normalizeHostname", () => {
  it("lowercases and strips trailing dot", () => {
    assert.equal(normalizeHostname("Example.COM."), "example.com");
  });
});

describe("isValidHostname", () => {
  it("accepts .local dev names", () => {
    assert.equal(isValidHostname("myapp.local"), true);
  });

  it("rejects empty", () => {
    assert.equal(isValidHostname(""), false);
  });

  it("accepts public domains", () => {
    assert.equal(isValidHostname("app.example.com"), true);
  });
});

describe("hostnamesFromProject", () => {
  it("merges domain field and domain rows", () => {
    const hosts = hostnamesFromProject({
      domain: "Legacy.Example.com",
      domains: [{ hostname: "www.example.com" }, { hostname: "api.example.com" }]
    });
    assert.deepEqual(hosts.sort(), ["api.example.com", "legacy.example.com", "www.example.com"]);
  });
});
