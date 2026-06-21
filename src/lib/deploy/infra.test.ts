import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectNeedsInfra } from "@/lib/deploy/infra";

describe("projectNeedsInfra", () => {
  it("returns true for Laravel + nginx without port", () => {
    assert.equal(
      projectNeedsInfra({
        webServer: "nginx",
        port: null,
        framework: "laravel",
        runtime: "php-fpm"
      }),
      true
    );
  });

  it("returns true for Node + nginx with port", () => {
    assert.equal(
      projectNeedsInfra({
        webServer: "nginx",
        port: 3001,
        framework: "nextjs",
        runtime: "node"
      }),
      true
    );
  });

  it("returns false for Laravel without webServer", () => {
    assert.equal(
      projectNeedsInfra({
        webServer: null,
        port: null,
        framework: "laravel",
        runtime: "php-fpm"
      }),
      false
    );
  });

  it("returns false for Next.js + nginx without port", () => {
    assert.equal(
      projectNeedsInfra({
        webServer: "nginx",
        port: null,
        framework: "nextjs",
        runtime: "node"
      }),
      false
    );
  });

  it("returns true for static stack + nginx without port", () => {
    assert.equal(
      projectNeedsInfra({
        webServer: "nginx",
        port: null,
        framework: "static",
        runtime: "static"
      }),
      true
    );
  });
});
