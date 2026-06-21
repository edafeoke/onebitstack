import { slugify } from "@/lib/deploy/slug";
import { projectLogsDir } from "@/lib/server-layout";

export type LogSource = "nginx" | "apache" | "pm2" | "app" | "deployment";

export function resolveRemoteLogCommand(input: {
  source: LogSource;
  tail: number;
  projectSlug?: string;
  pm2AppName?: string;
  deployRoot?: string | null;
}): { command: string; label: string } | { deployment: true } {
  const n = Math.min(2000, Math.max(20, input.tail));

  switch (input.source) {
    case "nginx":
      return {
        command: `tail -n ${n} /var/log/nginx/error.log 2>/dev/null || tail -n ${n} /var/log/nginx/access.log 2>/dev/null || echo "(nginx log not found)"`,
        label: "/var/log/nginx/error.log"
      };
    case "apache":
      return {
        command: `tail -n ${n} /var/log/apache2/error.log 2>/dev/null || tail -n ${n} /var/log/httpd/error_log 2>/dev/null || echo "(apache log not found)"`,
        label: "/var/log/apache2/error.log"
      };
    case "pm2": {
      const app = input.pm2AppName ?? input.projectSlug ?? "";
      const logDir = app ? projectLogsDir(app, input.deployRoot) : "";
      if (app) {
        return {
          command: `pm2 logs ${app} --raw --lines ${n} --nostream 2>/dev/null || tail -n ${n} ${logDir}/pm2-out.log 2>/dev/null || echo "(pm2 logs unavailable)"`,
          label: `pm2:${app}`
        };
      }
      return {
        command: `pm2 logs --raw --lines ${n} --nostream 2>/dev/null || echo "(pm2 logs unavailable)"`,
        label: "pm2"
      };
    }
    case "app": {
      const slug = input.projectSlug ?? "app";
      const logDir = projectLogsDir(slug, input.deployRoot);
      return {
        command: `tail -n ${n} ${logDir}/pm2-error.log 2>/dev/null; tail -n ${n} ${logDir}/pm2-out.log 2>/dev/null`,
        label: `${logDir}/`
      };
    }
    case "deployment":
      return { deployment: true };
    default:
      return {
        command: `echo "Unknown log source"`,
        label: "unknown"
      };
  }
}

export function projectSlugFromName(name: string): string {
  return slugify(name);
}
