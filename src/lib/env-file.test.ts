import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { upsertEnvFile, resolveEnvFilePath } from "@/lib/env-file";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("env-file", () => {
  it("upserts keys in a temp env file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "central-env-"));
    const prev = process.cwd();
    process.chdir(dir);
    try {
      await fs.writeFile(resolveEnvFilePath(), "FOO=bar\n", "utf8");
      await upsertEnvFile({
        NEXT_PUBLIC_APP_URL: "https://central.example.com",
        BETTER_AUTH_URL: "https://central.example.com"
      });
      const content = await fs.readFile(resolveEnvFilePath(), "utf8");
      assert.match(content, /NEXT_PUBLIC_APP_URL=https:\/\/central\.example\.com/);
      assert.match(content, /FOO=bar/);
    } finally {
      process.chdir(prev);
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects disallowed keys", async () => {
    await assert.rejects(() => upsertEnvFile({ EVIL_KEY: "nope" }));
  });
});
