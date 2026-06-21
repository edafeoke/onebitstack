import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeOrgRole, isOrgRole, isUserRole } from "@/lib/auth/roles";

describe("normalizeOrgRole", () => {
  it("passes through canonical roles", () => {
    assert.equal(normalizeOrgRole("owner"), "owner");
    assert.equal(normalizeOrgRole("developer"), "developer");
    assert.equal(normalizeOrgRole("viewer"), "viewer");
  });

  it("maps legacy admin to admin", () => {
    assert.equal(normalizeOrgRole("admin"), "admin");
  });

  it("maps legacy member to developer", () => {
    assert.equal(normalizeOrgRole("member"), "developer");
  });

  it("defaults unknown to viewer", () => {
    assert.equal(normalizeOrgRole("unknown"), "viewer");
  });
});

describe("role validators", () => {
  it("isUserRole", () => {
    assert.equal(isUserRole("admin"), true);
    assert.equal(isUserRole("user"), true);
    assert.equal(isUserRole("owner"), false);
  });

  it("isOrgRole", () => {
    assert.equal(isOrgRole("viewer"), true);
    assert.equal(isOrgRole("member"), false);
  });
});
