import {
  projectsAccessibleWhere,
  serversAccessibleWhere
} from "@/lib/organization/access";
import { sslExpiryWarnDays } from "@/lib/production/config";
import { prisma } from "@/lib/prisma";

export type HealthAlertSeverity = "info" | "warning" | "error";

export type HealthAlert = {
  id: string;
  severity: HealthAlertSeverity;
  title: string;
  detail: string;
  href?: string;
};

const AGENT_STALE_MS = 120_000;
const STUCK_DEPLOY_MS = 60 * 60 * 1000;

export async function collectHealthAlerts(userId: string): Promise<HealthAlert[]> {
  const alerts: HealthAlert[] = [];
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const warnBefore = new Date(now + sslExpiryWarnDays() * 24 * 60 * 60 * 1000);

  const [failedCount, stuck, servers, projectsMissingTls] = await Promise.all([
    prisma.deployment.count({
      where: {
        project: projectsAccessibleWhere(userId),
        status: "failed",
        createdAt: { gte: since24h }
      }
    }),
    prisma.deployment.findMany({
      where: {
        project: projectsAccessibleWhere(userId),
        status: "running",
        startedAt: { lt: new Date(now - STUCK_DEPLOY_MS) }
      },
      take: 5,
      select: {
        id: true,
        project: { select: { id: true, name: true } }
      }
    }),
    prisma.server.findMany({
      where: serversAccessibleWhere(userId),
      select: {
        id: true,
        name: true,
        agentId: true,
        agentStatus: true,
        lastAgentHeartbeatAt: true,
        tlsCertPath: true,
        tlsCertNotAfter: true
      }
    }),
    prisma.project.findMany({
      where: {
        ...projectsAccessibleWhere(userId),
        domain: { not: null },
        server: {
          tlsCertPath: ""
        }
      },
      take: 8,
      select: {
        id: true,
        name: true,
        domain: true,
        serverId: true,
        server: { select: { name: true } }
      }
    })
  ]);

  if (failedCount > 0) {
    alerts.push({
      id: "deploy-failed-24h",
      severity: "error",
      title: `${failedCount} failed deployment${failedCount === 1 ? "" : "s"} in 24h`,
      detail: "Review logs and fix build or server configuration.",
      href: "/dashboard/deployments"
    });
  }

  for (const d of stuck) {
    alerts.push({
      id: `deploy-stuck-${d.id}`,
      severity: "warning",
      title: `Deploy still running: ${d.project.name}`,
      detail: "This deployment has been running for over an hour.",
      href: `/dashboard/deployments/${d.id}`
    });
  }

  for (const s of servers) {
    if (s.tlsCertPath.trim() && s.tlsCertNotAfter) {
      const exp = s.tlsCertNotAfter.getTime();
      if (exp < now) {
        alerts.push({
          id: `tls-expired-${s.id}`,
          severity: "error",
          title: `TLS certificate expired: ${s.name}`,
          detail: `Expired ${s.tlsCertNotAfter.toISOString().slice(0, 10)}. Renew on the server SSL panel.`,
          href: `/dashboard/servers/${s.id}`
        });
      } else if (exp < warnBefore.getTime()) {
        alerts.push({
          id: `tls-expiring-${s.id}`,
          severity: "warning",
          title: `TLS certificate expiring soon: ${s.name}`,
          detail: `Expires ${s.tlsCertNotAfter.toISOString().slice(0, 10)}. Use Renew now or schedule certbot renew on the VPS.`,
          href: `/dashboard/servers/${s.id}`
        });
      }
    }
  }

  for (const s of servers) {
    if (!s.agentId) continue;
    const last = s.lastAgentHeartbeatAt?.getTime() ?? 0;
    const stale = !last || now - last > AGENT_STALE_MS;
    if (stale) {
      alerts.push({
        id: `agent-stale-${s.id}`,
        severity: "warning",
        title: `Central agent offline: ${s.name}`,
        detail: s.lastAgentHeartbeatAt
          ? `Last heartbeat ${s.lastAgentHeartbeatAt.toISOString()}.`
          : "No heartbeat received yet.",
        href: `/dashboard/servers/${s.id}`
      });
    }
  }

  for (const p of projectsMissingTls) {
    const domain = p.domain?.trim();
    if (!domain || domain.endsWith(".local")) continue;
    alerts.push({
      id: `tls-missing-${p.id}`,
      severity: "info",
      title: `TLS not configured for ${p.name}`,
      detail: `Public domain ${domain} on server ${p.server.name} — set certificate paths or issue Let's Encrypt.`,
      href: `/dashboard/servers/${p.serverId}`
    });
  }

  return alerts;
}
