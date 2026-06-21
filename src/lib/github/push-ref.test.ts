import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractInstallationId,
  extractPushCommitSha,
  parseGithubPushRef,
  repositoryFullName
} from "@/lib/github/push-ref";

describe("parseGithubPushRef", () => {
  it("parses branch refs", () => {
    assert.deepEqual(parseGithubPushRef("refs/heads/main"), { ok: true, branch: "main" });
  });

  it("rejects tags", () => {
    assert.equal(parseGithubPushRef("refs/tags/v1").ok, false);
  });
});

describe("extractPushCommitSha", () => {
  it("prefers head_commit.id", () => {
    assert.equal(
      extractPushCommitSha({ head_commit: { id: "abc123" }, after: "def456" }),
      "abc123"
    );
  });

  it("ignores empty after sha", () => {
    assert.equal(
      extractPushCommitSha({
        after: "0000000000000000000000000000000000000000"
      }),
      null
    );
  });
});

describe("extractInstallationId", () => {
  it("stringifies numeric installation id", () => {
    assert.equal(extractInstallationId({ installation: { id: 42 } }), "42");
  });
});

describe("repositoryFullName", () => {
  it("reads repository.full_name", () => {
    assert.equal(
      repositoryFullName({ repository: { full_name: "org/repo" } }),
      "org/repo"
    );
  });
});
