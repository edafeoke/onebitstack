import type { Environment, Project, Server } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type PushDeployTarget = {
  environment: Environment;
  project: Project & { server: Server };
};

export async function findEnvironmentsForGithubPush(input: {
  repository: string;
  branch: string;
  installationId?: string | null;
}): Promise<{ targets: PushDeployTarget[]; skipReason?: string }> {
  if (input.installationId) {
    const installation = await prisma.gitHubAppInstallation.findFirst({
      where: { installationId: input.installationId },
      select: { id: true, suspended: true }
    });
    if (!installation) {
      return { targets: [], skipReason: "unknown_installation" };
    }
    if (installation.suspended) {
      return { targets: [], skipReason: "installation_suspended" };
    }
  }

  const projectFilter: {
    repository: string;
    githubInstallationId?: string;
  } = { repository: input.repository };

  if (input.installationId) {
    projectFilter.githubInstallationId = input.installationId;
  }

  const environments = await prisma.environment.findMany({
    where: {
      branch: input.branch,
      project: projectFilter
    },
    include: {
      project: { include: { server: true } }
    }
  });

  if (environments.length === 0) {
    return { targets: [], skipReason: "no_matching_environment" };
  }

  return {
    targets: environments.map((env) => ({
      environment: env,
      project: env.project
    }))
  };
}
