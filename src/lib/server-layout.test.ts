import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_VPS_DEPLOY_ROOT,
  defaultProjectDeploymentPath,
  persistentDatabasePath,
  projectLogsDir,
  serverLayoutFromRoot
} from "@/lib/server-layout";

describe("serverLayoutFromRoot", () => {
  it("defaults to /var/www/server", () => {
    const layout = serverLayoutFromRoot(null);
    assert.equal(layout.root, DEFAULT_VPS_DEPLOY_ROOT);
    assert.equal(layout.apps, `${DEFAULT_VPS_DEPLOY_ROOT}/apps`);
    assert.equal(layout.configsNginx, `${DEFAULT_VPS_DEPLOY_ROOT}/configs/nginx`);
    assert.equal(layout.data, `${DEFAULT_VPS_DEPLOY_ROOT}/data`);
    assert.equal(layout.logs, `${DEFAULT_VPS_DEPLOY_ROOT}/logs`);
  });

  it("normalizes trailing slashes", () => {
    const layout = serverLayoutFromRoot("/opt/central/");
    assert.equal(layout.root, "/opt/central");
    assert.equal(defaultProjectDeploymentPath("/opt/central/", "my-app"), "/opt/central/apps/my-app");
  });
});

describe("per-project paths", () => {
  it("builds data and log paths under deploy root", () => {
    assert.equal(
      persistentDatabasePath("my-app", DEFAULT_VPS_DEPLOY_ROOT),
      `${DEFAULT_VPS_DEPLOY_ROOT}/data/my-app/app.db`
    );
    assert.equal(
      projectLogsDir("my-app", DEFAULT_VPS_DEPLOY_ROOT),
      `${DEFAULT_VPS_DEPLOY_ROOT}/logs/my-app`
    );
  });
});
