import type { DetectedStack } from "@/lib/github/detect-tech-stack";

export type RuntimeConfigArtifact = {
  /** Optional .env-style lines for remote (no secrets by default). */
  envFileBody: string;
  /** Human-readable notes for operators. */
  notes: string[];
};

/**
 * Structured runtime hints (versions are enforced on the server via provisioning).
 */
export function generateRuntimeConfig(input: {
  framework: string | null;
  runtime: string | null;
  port: number;
  domain?: string | null;
}): RuntimeConfigArtifact {
  const notes: string[] = [];
  const lines: string[] = [`PORT=${input.port}`, `NODE_ENV=production`];
  if (input.domain) {
    lines.push(`APP_URL=https://${input.domain}`);
    notes.push("Set APP_URL when TLS is enabled.");
  }
  const fw = input.framework ?? "unknown";
  const rt = input.runtime ?? "node";
  notes.push(`Detected framework=${fw}, runtime=${rt}.`);
  if (rt === "php-fpm") {
    lines.push("APP_DEBUG=false");
    notes.push("PHP: ensure php-fpm pool matches this app.");
  }
  if (rt === "python") {
    notes.push("Python: use a venv on the server before startCommand.");
  }
  if (fw === "docker") {
    notes.push("Docker: prefer compose and published port mapping to internal PORT.");
  }
  return { envFileBody: lines.join("\n") + "\n", notes };
}

export function runtimeDefaultsFromDetected(stack: DetectedStack): {
  buildCommand: string;
  startCommand: string;
  restartCommand: string;
} {
  return {
    buildCommand: stack.buildCommand,
    startCommand: stack.startCommand,
    restartCommand: stack.restartCommand
  };
}
