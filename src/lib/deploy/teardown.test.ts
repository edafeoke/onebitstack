import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_VPS_DEPLOY_ROOT } from "@/lib/server-layout";
import { buildProjectTeardownScript } from "@/lib/deploy/teardown";

const APP = `${DEFAULT_VPS_DEPLOY_ROOT}/apps/my-app`;

describe("buildProjectTeardownScript", () => {
  it("removes nginx site and runs nginx -t for nginx webServer", () => {
    const script = buildProjectTeardownScript({
      slug: "my-app",
      appRoot: APP,
      deployRoot: DEFAULT_VPS_DEPLOY_ROOT,
      webServer: "nginx",
      runtime: "php-fpm"
    });
    assert.match(script, /sites-enabled\/my-app\.conf/);
    assert.match(script, new RegExp(`${DEFAULT_VPS_DEPLOY_ROOT}/configs/nginx/my-app\\.conf`));
    assert.doesNotMatch(script, /pm2 delete/);
  });

  it("includes pm2 delete for node runtime", () => {
    const script = buildProjectTeardownScript({
      slug: "my-app",
      appRoot: APP,
      deployRoot: DEFAULT_VPS_DEPLOY_ROOT,
      webServer: "nginx",
      runtime: "node"
    });
    assert.match(script, /pm2 delete/);
    assert.match(script, new RegExp(`${DEFAULT_VPS_DEPLOY_ROOT}/configs/pm2/my-app\\.config\\.cjs`));
  });

  it("removes app root logs and persistent data under deploy root", () => {
    const script = buildProjectTeardownScript({
      slug: "test-laravel-react",
      appRoot: `${DEFAULT_VPS_DEPLOY_ROOT}/apps/test-laravel-react`,
      deployRoot: DEFAULT_VPS_DEPLOY_ROOT,
      webServer: "nginx",
      runtime: "php-fpm"
    });
    assert.match(script, /rm -rf "\$APP_ROOT"/);
    assert.match(script, new RegExp(`${DEFAULT_VPS_DEPLOY_ROOT}/logs/test-laravel-react`));
    assert.match(script, new RegExp(`${DEFAULT_VPS_DEPLOY_ROOT}/data/test-laravel-react`));
  });

  it("does not rm -rf when skipAppDirectoryRemoval is set", () => {
    const script = buildProjectTeardownScript({
      slug: "my-app",
      appRoot: "/var/www/app",
      deployRoot: DEFAULT_VPS_DEPLOY_ROOT,
      webServer: "nginx",
      runtime: "php-fpm",
      skipAppDirectoryRemoval: true
    });
    assert.match(script, /Skipping app directory removal/);
    assert.doesNotMatch(script, /rm -rf "\$APP_ROOT"/);
  });
});
