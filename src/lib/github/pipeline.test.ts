import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDeployPipeline } from "@/lib/github/pipeline";
import { inferStackFromRootFiles } from "@/lib/github/detect-tech-stack";

describe("resolveDeployPipeline", () => {
  it("maps Laravel to nginx without app port", () => {
    const p = resolveDeployPipeline({ framework: "laravel", runtime: "php-fpm" });
    assert.equal(p.id, "laravel");
    assert.equal(p.defaultWebServer, "nginx");
    assert.equal(p.needsAppPort, false);
  });

  it("maps Next.js to node pipeline with port", () => {
    const p = resolveDeployPipeline({ framework: "nextjs", runtime: "node" });
    assert.equal(p.id, "nextjs");
    assert.equal(p.needsAppPort, true);
  });

  it("detects next.config without next in package.json deps", () => {
    const stack = inferStackFromRootFiles({
      packageJson: JSON.stringify({ scripts: { build: "next build", start: "next start" } }),
      composerJson: null,
      indexHtml: null,
      requirementsTxt: null,
      pyprojectToml: null,
      dockerfile: null,
      goMod: null,
      nextConfig: "export default {}"
    });
    assert.equal(stack.framework, "nextjs");
  });
});
