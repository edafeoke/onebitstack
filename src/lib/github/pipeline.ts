import type { DetectedStack } from "@/lib/github/detect-tech-stack";
import { projectNeedsAppPort } from "@/lib/port-allocation";

export type DeployPipelineId =
  | "laravel"
  | "nextjs"
  | "nodejs"
  | "static"
  | "python"
  | "docker"
  | "go";

export type DeployPipeline = {
  id: DeployPipelineId;
  label: string;
  description: string;
  defaultWebServer: "nginx" | null;
  needsAppPort: boolean;
};

export function resolveDeployPipeline(
  stack: Pick<DetectedStack, "framework" | "runtime">
): DeployPipeline {
  const fw = stack.framework.toLowerCase();
  const rt = stack.runtime.toLowerCase();
  const needsAppPort = projectNeedsAppPort(fw, rt);

  if (fw === "laravel" || fw === "laravel-react" || rt === "php-fpm") {
    return {
      id: "laravel",
      label: fw === "laravel-react" ? "Laravel + frontend" : "Laravel / PHP-FPM",
      description:
        "Composer (and npm for SPA) build, shared storage, nginx + PHP-FPM, optional SQLite/MySQL migrations.",
      defaultWebServer: "nginx",
      needsAppPort: false
    };
  }

  if (fw === "nextjs") {
    return {
      id: "nextjs",
      label: "Next.js",
      description: "Node build, PM2 or nginx reverse proxy to the app port.",
      defaultWebServer: "nginx",
      needsAppPort: true
    };
  }

  if (fw === "static" && rt === "static") {
    return {
      id: "static",
      label: "Static site",
      description: "No app process — nginx serves files from the release directory.",
      defaultWebServer: "nginx",
      needsAppPort: false
    };
  }

  if (rt === "python" || fw === "django" || fw === "fastapi") {
    return {
      id: "python",
      label: "Python",
      description: "Virtualenv install, PM2-managed WSGI/ASGI or custom start command.",
      defaultWebServer: "nginx",
      needsAppPort: true
    };
  }

  if (fw === "docker" || rt === "docker") {
    return {
      id: "docker",
      label: "Docker",
      description: "Image build and container run — verify port mapping on the server.",
      defaultWebServer: null,
      needsAppPort: true
    };
  }

  if (fw === "go" || rt === "go") {
    return {
      id: "go",
      label: "Go",
      description: "Compile binary on the server, PM2 or systemd to keep it running.",
      defaultWebServer: "nginx",
      needsAppPort: true
    };
  }

  return {
    id: "nodejs",
    label: "Node.js",
    description: "Install dependencies, build assets, PM2 + nginx proxy to the app port.",
    defaultWebServer: "nginx",
    needsAppPort: needsAppPort
  };
}

export type StackWithPipeline = DetectedStack & { pipeline: DeployPipeline };

export function withDeployPipeline(stack: DetectedStack): StackWithPipeline {
  return { ...stack, pipeline: resolveDeployPipeline(stack) };
}
