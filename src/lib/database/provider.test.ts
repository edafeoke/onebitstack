import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultSqliteDatabaseUrl,
  getDatabaseProvider,
  isSqliteTrialMode
} from "./provider";

describe("getDatabaseProvider", () => {
  it("defaults to postgresql", () => {
    const prev = process.env.CENTRAL_DATABASE_PROVIDER;
    delete process.env.CENTRAL_DATABASE_PROVIDER;
    assert.equal(getDatabaseProvider(), "postgresql");
    if (prev) process.env.CENTRAL_DATABASE_PROVIDER = prev;
  });

  it("returns sqlite when set", () => {
    process.env.CENTRAL_DATABASE_PROVIDER = "sqlite";
    assert.equal(getDatabaseProvider(), "sqlite");
    assert.equal(isSqliteTrialMode(), true);
    assert.match(defaultSqliteDatabaseUrl(), /^file:/);
    process.env.CENTRAL_DATABASE_PROVIDER = "postgresql";
  });
});
