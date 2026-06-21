import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLaravelStorageSymlinkScript } from "@/lib/deploy/apply-infra";

describe("buildLaravelStorageSymlinkScript", () => {
  it("symlinks entire storage and chowns for www-data", () => {
    const script = buildLaravelStorageSymlinkScript("/var/www/apps/my-app");
    assert.match(script, /ln -sfn "\$SHARED" "\$CURRENT\/storage"/);
    assert.match(script, /framework\/views/);
    assert.match(script, /run_root chown -R "\$WEB_USER:\$WEB_USER"/);
    assert.match(script, /run_root chmod -R ug\+rwx/);
    assert.match(script, /bootstrap\/cache/);
  });
});
