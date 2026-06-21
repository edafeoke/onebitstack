import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveProductionPhpDatabase,
  shouldUsePersistentSqlitePath
} from "@/lib/deploy/production-env";

describe("shouldUsePersistentSqlitePath", () => {
  it("rewrites relative and release paths", () => {
    assert.equal(shouldUsePersistentSqlitePath(""), true);
    assert.equal(shouldUsePersistentSqlitePath("database/database.sqlite"), true);
    assert.equal(
      shouldUsePersistentSqlitePath(
        "/var/www/apps/x/releases/abc/database/database.sqlite"
      ),
      true
    );
    assert.equal(shouldUsePersistentSqlitePath("/var/www/server/data/x/app.db"), false);
  });
});

describe("resolveProductionPhpDatabase", () => {
  it("defaults sqlite to persistent path", () => {
    const env = resolveProductionPhpDatabase("my-app", {
      DB_CONNECTION: "sqlite"
    });
    assert.equal(env.DB_DATABASE, "/var/www/server/data/my-app/app.db");
  });
});
