import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEnsurePhpSqliteExtensionScript,
  formatSqliteDriverHint
} from "@/lib/deploy/php-sqlite";

describe("buildEnsurePhpSqliteExtensionScript", () => {
  it("installs versioned sqlite package when pdo_sqlite missing", () => {
    const script = buildEnsurePhpSqliteExtensionScript();
    assert.doesNotMatch(script, /then exit 0/);
    assert.match(script, /php\$\{PHP_VER\}-sqlite3/);
    assert.match(script, /pdo_sqlite/);
  });
});

describe("formatSqliteDriverHint", () => {
  it("includes php version in apt package name", () => {
    assert.match(formatSqliteDriverHint("8.4"), /php8\.4-sqlite3/);
  });
});
