import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCredentialAuthEnabled,
  isSaasMode
} from "@/lib/auth-config";

describe("isSaasMode", () => {
  const prevMode = process.env.DEPLOYMENT_MODE;
  const prevEdition = process.env.CENTRAL_EDITION;

  const restore = () => {
    if (prevMode === undefined) delete process.env.DEPLOYMENT_MODE;
    else process.env.DEPLOYMENT_MODE = prevMode;
    if (prevEdition === undefined) delete process.env.CENTRAL_EDITION;
    else process.env.CENTRAL_EDITION = prevEdition;
  };

  it("defaults to self_hosted on control plane edition", () => {
    delete process.env.DEPLOYMENT_MODE;
    process.env.CENTRAL_EDITION = "control_plane";
    assert.equal(isSaasMode(), false);
    restore();
  });

  it("defaults to saas on website edition", () => {
    delete process.env.DEPLOYMENT_MODE;
    process.env.CENTRAL_EDITION = "website";
    assert.equal(isSaasMode(), true);
    restore();
  });

  it("returns false for self_hosted", () => {
    process.env.DEPLOYMENT_MODE = "self_hosted";
    assert.equal(isSaasMode(), false);
    restore();
  });
});

describe("isCredentialAuthEnabled", () => {
  const prevCred = process.env.ENABLE_CREDENTIAL_AUTH;
  const prevMode = process.env.DEPLOYMENT_MODE;
  const prevEdition = process.env.CENTRAL_EDITION;

  const restore = () => {
    if (prevCred === undefined) delete process.env.ENABLE_CREDENTIAL_AUTH;
    else process.env.ENABLE_CREDENTIAL_AUTH = prevCred;
    if (prevMode === undefined) delete process.env.DEPLOYMENT_MODE;
    else process.env.DEPLOYMENT_MODE = prevMode;
    if (prevEdition === undefined) delete process.env.CENTRAL_EDITION;
    else process.env.CENTRAL_EDITION = prevEdition;
  };

  it("is true on control plane by default", () => {
    delete process.env.ENABLE_CREDENTIAL_AUTH;
    delete process.env.DEPLOYMENT_MODE;
    process.env.CENTRAL_EDITION = "control_plane";
    assert.equal(isCredentialAuthEnabled(), true);
    restore();
  });

  it("is false when explicitly disabled", () => {
    process.env.ENABLE_CREDENTIAL_AUTH = "false";
    assert.equal(isCredentialAuthEnabled(), false);
    restore();
  });

  it("is false in self_hosted when explicitly disabled via env", () => {
    process.env.ENABLE_CREDENTIAL_AUTH = "false";
    process.env.DEPLOYMENT_MODE = "self_hosted";
    assert.equal(isCredentialAuthEnabled(), false);
    restore();
  });
});
