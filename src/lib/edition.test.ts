import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { getEdition, isWebsiteEdition } from "@/lib/edition";
import { isSaasMode } from "@/lib/auth-config";

describe("edition", () => {
  const prev = process.env.CENTRAL_EDITION;
  const prevDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.CENTRAL_EDITION;
    else process.env.CENTRAL_EDITION = prev;
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it("defaults to website when DATABASE_URL is unset", () => {
    delete process.env.CENTRAL_EDITION;
    delete process.env.DATABASE_URL;
    assert.equal(getEdition(), "website");
  });

  it("defaults to control_plane when DATABASE_URL is set", () => {
    delete process.env.CENTRAL_EDITION;
    process.env.DATABASE_URL = "postgresql://localhost/central";
    assert.equal(getEdition(), "control_plane");
  });

  it("returns website for website edition", () => {
    process.env.CENTRAL_EDITION = "website";
    assert.equal(isWebsiteEdition(), true);
  });

  it("returns website for marketing alias", () => {
    process.env.CENTRAL_EDITION = "marketing";
    assert.equal(getEdition(), "website");
  });
});

describe("auth-config with edition", () => {
  const prevEdition = process.env.CENTRAL_EDITION;
  const prevMode = process.env.DEPLOYMENT_MODE;

  afterEach(() => {
    if (prevEdition === undefined) delete process.env.CENTRAL_EDITION;
    else process.env.CENTRAL_EDITION = prevEdition;
    if (prevMode === undefined) delete process.env.DEPLOYMENT_MODE;
    else process.env.DEPLOYMENT_MODE = prevMode;
  });

  it("control_plane defaults to self_hosted (not saas)", () => {
    process.env.CENTRAL_EDITION = "control_plane";
    delete process.env.DEPLOYMENT_MODE;
    assert.equal(isSaasMode(), false);
  });

  it("website edition defaults to saas when mode unset", () => {
    process.env.CENTRAL_EDITION = "website";
    delete process.env.DEPLOYMENT_MODE;
    assert.equal(isSaasMode(), true);
  });
});
