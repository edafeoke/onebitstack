import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGithubAppManifest, formatGithubAppEnvBlock, privateKeyForEnv } from "./setup";

describe("buildGithubAppManifest", () => {
  it("includes webhook and oauth URLs", () => {
    const m = buildGithubAppManifest("https://central.example.com");
    assert.equal(m.hook_attributes.url, "https://central.example.com/api/github/webhook");
    assert.equal(m.redirect_url, "https://central.example.com/setup/github/callback");
    assert.deepEqual(m.callback_urls, [
      "https://central.example.com/api/auth/callback/github"
    ]);
    assert.ok(m.default_events.includes("push"));
    assert.ok(m.default_events.includes("installation"));
  });
});

describe("formatGithubAppEnvBlock", () => {
  it("escapes PEM newlines", () => {
    const block = formatGithubAppEnvBlock({
      appId: "1",
      clientId: "cid",
      clientSecret: "sec",
      webhookSecret: "wh",
      appSlug: "my-app",
      privateKey: "-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----",
      name: "Test"
    });
    assert.match(block, /GITHUB_PRIVATE_KEY=.*\\n/);
    assert.equal(
      privateKeyForEnv("-----BEGIN\nX\n-----END"),
      "-----BEGIN\\nX\\n-----END"
    );
  });
});
