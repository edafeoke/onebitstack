-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WebStack" AS ENUM ('none', 'nginx', 'apache', 'caddy');

-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('pending', 'claimed', 'running', 'success', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "EnvScope" AS ENUM ('production', 'preview', 'development');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('queued', 'running', 'success', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "DeploymentTrigger" AS ENUM ('manual', 'git_push', 'api');

-- CreateEnum
CREATE TYPE "DeploymentKind" AS ENUM ('full', 'config_only', 'rollback');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "githubId" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubAppInstallation" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "installerGithubId" TEXT,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubAppInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "sshUser" TEXT NOT NULL,
    "sshPrivateKeyCipher" TEXT NOT NULL,
    "sshPrivateKeyIv" TEXT NOT NULL,
    "sshPrivateKeyTag" TEXT NOT NULL,
    "webStack" "WebStack" NOT NULL DEFAULT 'none',
    "reverseProxyNotes" TEXT NOT NULL DEFAULT '',
    "tlsCertPath" TEXT NOT NULL DEFAULT '',
    "tlsKeyPath" TEXT NOT NULL DEFAULT '',
    "reverseProxyConfigPath" TEXT NOT NULL DEFAULT '',
    "deployRoot" TEXT NOT NULL DEFAULT '/var/www/server',
    "capabilitiesJson" TEXT NOT NULL DEFAULT '',
    "lastCapabilityProbeAt" TIMESTAMP(3),
    "agentStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "agentId" TEXT,
    "agentTokenHash" TEXT,
    "agentVersion" TEXT,
    "lastAgentHeartbeatAt" TIMESTAMP(3),
    "agentPairingTokenHash" TEXT,
    "agentPairingExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'pending',
    "scriptCipher" TEXT NOT NULL,
    "scriptIv" TEXT NOT NULL,
    "scriptTag" TEXT NOT NULL,
    "exitCode" INTEGER,
    "claimedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "githubInstallationId" TEXT,
    "name" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "deploymentPath" TEXT NOT NULL,
    "framework" TEXT,
    "runtime" TEXT,
    "domain" TEXT,
    "webServer" TEXT,
    "nginxConfig" TEXT,
    "apacheConfig" TEXT,
    "pm2Config" TEXT,
    "port" INTEGER,
    "buildCommand" TEXT NOT NULL DEFAULT '',
    "startCommand" TEXT NOT NULL DEFAULT '',
    "restartCommand" TEXT NOT NULL DEFAULT '',
    "infraJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEnvVar" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "scope" "EnvScope" NOT NULL DEFAULT 'production',
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "valueCipher" TEXT NOT NULL DEFAULT '',
    "valueIv" TEXT NOT NULL DEFAULT '',
    "valueTag" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEnvVar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDomain" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'queued',
    "commitHash" TEXT,
    "trigger" "DeploymentTrigger" NOT NULL,
    "kind" "DeploymentKind" NOT NULL DEFAULT 'full',
    "releasePath" TEXT,
    "assignedPort" INTEGER,
    "parentDeploymentId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentLogChunk" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "line" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentLogChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "action" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "repository" TEXT,
    "branch" TEXT,
    "commitHash" TEXT,
    "projectId" TEXT,
    "deploymentId" TEXT,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningRun" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisioningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningLogChunk" (
    "id" TEXT NOT NULL,
    "provisioningRunId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "line" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisioningLogChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_kind_idx" ON "Organization"("kind");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubAppInstallation_installationId_key" ON "GitHubAppInstallation"("installationId");

-- CreateIndex
CREATE INDEX "GitHubAppInstallation_organizationId_idx" ON "GitHubAppInstallation"("organizationId");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Server_agentId_key" ON "Server"("agentId");

-- CreateIndex
CREATE INDEX "Server_userId_idx" ON "Server"("userId");

-- CreateIndex
CREATE INDEX "Server_organizationId_idx" ON "Server"("organizationId");

-- CreateIndex
CREATE INDEX "Server_agentStatus_idx" ON "Server"("agentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AgentJob_deploymentId_key" ON "AgentJob"("deploymentId");

-- CreateIndex
CREATE INDEX "AgentJob_serverId_status_idx" ON "AgentJob"("serverId", "status");

-- CreateIndex
CREATE INDEX "AgentJob_createdAt_idx" ON "AgentJob"("createdAt");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "Project_serverId_idx" ON "Project"("serverId");

-- CreateIndex
CREATE INDEX "Project_repository_idx" ON "Project"("repository");

-- CreateIndex
CREATE UNIQUE INDEX "Project_serverId_port_key" ON "Project"("serverId", "port");

-- CreateIndex
CREATE INDEX "ProjectEnvVar_projectId_idx" ON "ProjectEnvVar"("projectId");

-- CreateIndex
CREATE INDEX "ProjectEnvVar_projectId_scope_idx" ON "ProjectEnvVar"("projectId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEnvVar_projectId_key_scope_key" ON "ProjectEnvVar"("projectId", "key", "scope");

-- CreateIndex
CREATE INDEX "ProjectDomain_projectId_idx" ON "ProjectDomain"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDomain_serverId_idx" ON "ProjectDomain"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDomain_projectId_hostname_key" ON "ProjectDomain"("projectId", "hostname");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDomain_hostname_serverId_key" ON "ProjectDomain"("hostname", "serverId");

-- CreateIndex
CREATE INDEX "Environment_projectId_idx" ON "Environment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_projectId_slug_key" ON "Environment"("projectId", "slug");

-- CreateIndex
CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");

-- CreateIndex
CREATE INDEX "Deployment_environmentId_idx" ON "Deployment"("environmentId");

-- CreateIndex
CREATE INDEX "Deployment_createdAt_idx" ON "Deployment"("createdAt");

-- CreateIndex
CREATE INDEX "Deployment_parentDeploymentId_idx" ON "Deployment"("parentDeploymentId");

-- CreateIndex
CREATE INDEX "DeploymentLogChunk_deploymentId_seq_idx" ON "DeploymentLogChunk"("deploymentId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentLogChunk_deploymentId_seq_key" ON "DeploymentLogChunk"("deploymentId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_deliveryId_key" ON "WebhookDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_repository_idx" ON "WebhookDelivery"("repository");

-- CreateIndex
CREATE INDEX "ProvisioningRun_serverId_idx" ON "ProvisioningRun"("serverId");

-- CreateIndex
CREATE INDEX "ProvisioningRun_createdAt_idx" ON "ProvisioningRun"("createdAt");

-- CreateIndex
CREATE INDEX "ProvisioningLogChunk_provisioningRunId_seq_idx" ON "ProvisioningLogChunk"("provisioningRunId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ProvisioningLogChunk_provisioningRunId_seq_key" ON "ProvisioningLogChunk"("provisioningRunId", "seq");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubAppInstallation" ADD CONSTRAINT "GitHubAppInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEnvVar" ADD CONSTRAINT "ProjectEnvVar_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDomain" ADD CONSTRAINT "ProjectDomain_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_parentDeploymentId_fkey" FOREIGN KEY ("parentDeploymentId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentLogChunk" ADD CONSTRAINT "DeploymentLogChunk_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningRun" ADD CONSTRAINT "ProvisioningRun_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningLogChunk" ADD CONSTRAINT "ProvisioningLogChunk_provisioningRunId_fkey" FOREIGN KEY ("provisioningRunId") REFERENCES "ProvisioningRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
