import { prisma } from "@/lib/prisma";
import {
  installationsAccessibleWhere,
  projectsAccessibleWhere,
  serversAccessibleWhere
} from "@/lib/organization/access";
import { isProductionRuntime, isRedisQueueEnabled } from "@/lib/production/config";
import { isSaasMode } from "@/lib/auth-config";
import { isGithubAppConfigured } from "@/lib/github-app/config";

export type OnboardingStep = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export async function getOnboardingSteps(userId: string): Promise<OnboardingStep[]> {
  const [githubAccount, serverCount, installCount, projectCount] = await Promise.all([
    prisma.account.findFirst({
      where: { userId, providerId: "github" },
      select: { id: true }
    }),
    prisma.server.count({ where: serversAccessibleWhere(userId) }),
    prisma.gitHubAppInstallation.count({ where: installationsAccessibleWhere(userId) }),
    prisma.project.count({ where: projectsAccessibleWhere(userId) })
  ]);

  const steps: OnboardingStep[] = [
    {
      id: "account",
      label: "Create your account",
      done: true,
      href: "/dashboard"
    },
    {
      id: "github",
      label: "Connect GitHub for repos and push-to-deploy",
      done: githubAccount != null,
      href: "/dashboard/settings"
    },
    ...(!isSaasMode()
      ? [
          {
            id: "github-app-server",
            label: "Configure GitHub App on this server (operator)",
            done: isGithubAppConfigured(),
            href: "/setup"
          } satisfies OnboardingStep
        ]
      : []),
    {
      id: "install",
      label: "Install the GitHub App on your org or account",
      done: installCount > 0,
      href: "/dashboard/settings"
    },
    {
      id: "server",
      label: "Add a VPS server (SSH)",
      done: serverCount > 0,
      href: "/dashboard/servers/new"
    },
    {
      id: "project",
      label: "Create your first project",
      done: projectCount > 0,
      href: "/dashboard/projects/new"
    }
  ];

  if (isProductionRuntime()) {
    steps.push({
      id: "redis",
      label: "Configure Redis and run the deploy worker",
      done: isRedisQueueEnabled(),
      href: "/dashboard/settings"
    });
  }

  return steps;
}

export function onboardingIncomplete(steps: OnboardingStep[]): boolean {
  return steps.some((s) => !s.done);
}
