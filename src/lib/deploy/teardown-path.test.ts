import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_VPS_DEPLOY_ROOT } from "@/lib/server-layout";
import { validateTeardownAppRoot } from "@/lib/deploy/teardown-path";

describe("validateTeardownAppRoot", () => {
  it("allows stored path when basename differs from current name slug", () => {
    const r = validateTeardownAppRoot(
      `${DEFAULT_VPS_DEPLOY_ROOT}/apps/t`,
      "testi",
      DEFAULT_VPS_DEPLOY_ROOT
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.appRoot, `${DEFAULT_VPS_DEPLOY_ROOT}/apps/t`);
    }
  });

  it("allows per-project path under deploy root apps", () => {
    const r = validateTeardownAppRoot(
      `${DEFAULT_VPS_DEPLOY_ROOT}/apps/my-app`,
      "my-app",
      DEFAULT_VPS_DEPLOY_ROOT
    );
    assert.equal(r.ok, true);
  });

  it("skips app tree removal for legacy shared /var/www/app", () => {
    const r = validateTeardownAppRoot("/var/www/app", "anything", DEFAULT_VPS_DEPLOY_ROOT);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.skipAppDirectoryRemoval, true);
    }
  });

  it("refuses protected parent deploy root apps dir", () => {
    const r = validateTeardownAppRoot(
      `${DEFAULT_VPS_DEPLOY_ROOT}/apps`,
      "my-app",
      DEFAULT_VPS_DEPLOY_ROOT
    );
    assert.equal(r.ok, false);
  });

  it("refuses protected deploy root itself", () => {
    const r = validateTeardownAppRoot(
      DEFAULT_VPS_DEPLOY_ROOT,
      "my-app",
      DEFAULT_VPS_DEPLOY_ROOT
    );
    assert.equal(r.ok, false);
  });
});
