import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNginxHostnamePreflightScript,
  buildNginxSiteInstallScript,
  nginxInstallPaths
} from "@/lib/nginx/install";

describe("nginx install scripts", () => {
  it("preflight skips when no hosts", () => {
    assert.equal(buildNginxHostnamePreflightScript({ slug: "app", hostnames: [] }), "exit 0");
  });

  it("preflight checks other enabled sites", () => {
    const script = buildNginxHostnamePreflightScript({
      slug: "my-app",
      hostnames: ["app.example.com"]
    });
    assert.match(script, /nginx hostname conflict/);
    assert.match(script, /sites-enabled/);
  });

  it("install script rolls back on nginx -t failure", () => {
    const paths = nginxInstallPaths("my-app", "/var/www/configs/nginx");
    const script = buildNginxSiteInstallScript(paths);
    assert.match(script, /nginx config test failed/);
    assert.match(script, /rm -f "\$ENABLED"/);
    assert.match(script, /systemctl reload nginx/);
  });
});
