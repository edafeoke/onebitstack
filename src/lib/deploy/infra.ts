import { isPhpFpmStack } from "@/lib/deployment/templates/nginx";
import { isStaticStack } from "@/lib/deployment/templates/nginx-common";

export type ProjectInfraInput = {
  webServer?: string | null;
  port?: number | null;
  framework?: string | null;
  runtime?: string | null;
};

/** Whether a deploy should run reverse-proxy / PM2 infra (nginx, apache, pm2). */
export function projectNeedsInfra(project: ProjectInfraInput): boolean {
  if (!project.webServer?.trim()) return false;
  if (project.port != null) return true;
  return (
    isPhpFpmStack(project.framework, project.runtime) ||
    isStaticStack(project.framework, project.runtime)
  );
}
