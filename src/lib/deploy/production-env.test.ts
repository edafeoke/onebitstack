import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productionPhpEnv } from "@/lib/deploy/production-env";
import type { ProjectEnvVar } from "@/generated/prisma/client";

function envVar(key: string, value: string): ProjectEnvVar {
  return {
    id: "1",
    projectId: "p1",
    key,
    value,
    scope: "production",
    isSecret: false,
    valueCipher: "",
    valueIv: "",
    valueTag: "",
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe("productionPhpEnv", () => {
  it("merges UI vars over Laravel defaults", () => {
    const env = productionPhpEnv({
      name: "my-app",
      domain: "app.example.com",
      envVars: [envVar("APP_NAME", "My Laravel"), envVar("APP_ENV", "staging")]
    } as Parameters<typeof productionPhpEnv>[0]);

    assert.equal(env.APP_NAME, "My Laravel");
    assert.equal(env.APP_ENV, "staging");
    assert.equal(env.APP_DEBUG, "false");
    assert.equal(env.APP_URL, "https://app.example.com");
  });

  it("sets defaults when UI has no vars", () => {
    const env = productionPhpEnv({
      name: "my-app",
      domain: null,
      envVars: []
    } as Parameters<typeof productionPhpEnv>[0]);

    assert.equal(env.APP_ENV, "production");
    assert.equal(env.APP_DEBUG, "false");
    assert.equal(env.APP_NAME, undefined);
  });

  it("rewrites relative sqlite path to persistent /var/www/data", () => {
    const env = productionPhpEnv({
      name: "test-laravel-react",
      domain: null,
      envVars: [
        envVar("DB_CONNECTION", "sqlite"),
        envVar("DB_DATABASE", "database/database.sqlite")
      ]
    } as Parameters<typeof productionPhpEnv>[0]);

    assert.equal(env.DB_CONNECTION, "sqlite");
    assert.equal(env.DB_DATABASE, "/var/www/server/data/test-laravel-react/app.db");
    assert.equal(env.DATABASE_URL, "file:/var/www/server/data/test-laravel-react/app.db");
  });
});
