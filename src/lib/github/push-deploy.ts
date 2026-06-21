import { prisma } from "@/lib/prisma";
import { appendDeploymentLogLine } from "@/lib/deploy";
import { enqueueDeployJob } from "@/lib/deploy-queue";
import { findEnvironmentsForGithubPush } from "@/lib/github/match-push";
import {
  extractInstallationId,
  extractPushCommitSha,
  parseGithubPushRef,
  repositoryFullName
} from "@/lib/github/push-ref";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  githubPushProjectRateLimit,
  githubWebhookRepoRateLimit
} from "@/lib/rate-limit/config";

export type PushDeployResult = {
  matched: boolean;
  deploymentIds: string[];
  skipReason?: string;
  repository?: string;
  branch?: string;
  commitHash?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function queueDeploymentsFromGithubPush(
  input: {
    fullName: string;
    branch: string;
    sha: string;
    installationId?: string | null;
  }
): Promise<PushDeployResult> {
  const repoLimit = await checkRateLimit(
    `github:repo:${input.fullName}`,
    githubWebhookRepoRateLimit()
  );
  if (!repoLimit.allowed) {
    return {
      matched: false,
      deploymentIds: [],
      skipReason: "repo_rate_limited",
      repository: input.fullName,
      branch: input.branch,
      commitHash: input.sha
    };
  }

  const { targets, skipReason } = await findEnvironmentsForGithubPush({
    repository: input.fullName,
    branch: input.branch,
    installationId: input.installationId
  });

  if (targets.length === 0) {
    return {
      matched: false,
      deploymentIds: [],
      skipReason,
      repository: input.fullName,
      branch: input.branch,
      commitHash: input.sha
    };
  }

  const deploymentIds: string[] = [];

  for (const { environment, project } of targets) {
    const projectLimit = await checkRateLimit(
      `github:project:${project.id}`,
      githubPushProjectRateLimit()
    );
    if (!projectLimit.allowed) {
      console.warn("[github] push deploy rate limited for project", project.id);
      continue;
    }

    const deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        environmentId: environment.id,
        status: "queued",
        commitHash: input.sha,
        trigger: "git_push"
      }
    });
    await appendDeploymentLogLine(
      deployment.id,
      `[github] Deployment queued from push (${input.sha.slice(0, 7)}) on branch ${input.branch}`
    );
    await enqueueDeployJob(deployment.id);
    deploymentIds.push(deployment.id);
  }

  return {
    matched: deploymentIds.length > 0,
    deploymentIds,
    skipReason: deploymentIds.length === 0 ? "project_rate_limited" : undefined,
    repository: input.fullName,
    branch: input.branch,
    commitHash: input.sha
  };
}

/** Parse a GitHub `push` webhook payload and queue matching deployments. */
export async function handleGithubPushPayload(payload: unknown): Promise<PushDeployResult> {
  if (!isRecord(payload)) {
    return { matched: false, deploymentIds: [], skipReason: "invalid_payload" };
  }

  const fullName = repositoryFullName(payload);
  if (!fullName) {
    return { matched: false, deploymentIds: [], skipReason: "missing_repository" };
  }

  const parsedRef = parseGithubPushRef(payload.ref);
  if (!parsedRef.ok) {
    return {
      matched: false,
      deploymentIds: [],
      skipReason: parsedRef.reason,
      repository: fullName
    };
  }

  const sha = extractPushCommitSha(payload);
  if (!sha) {
    return {
      matched: false,
      deploymentIds: [],
      skipReason: "missing_commit",
      repository: fullName,
      branch: parsedRef.branch
    };
  }

  return queueDeploymentsFromGithubPush({
    fullName,
    branch: parsedRef.branch,
    sha,
    installationId: extractInstallationId(payload)
  });
}

/** @deprecated Use queueDeploymentsFromGithubPush — kept for legacy webhook route. */
export async function handleGithubPushCreateDeployment(input: {
  fullName: string;
  branch: string;
  sha: string;
  installationId?: string | null;
}): Promise<{ matched: boolean; deploymentId?: string }> {
  const result = await queueDeploymentsFromGithubPush(input);
  return {
    matched: result.matched,
    deploymentId: result.deploymentIds[0]
  };
}
