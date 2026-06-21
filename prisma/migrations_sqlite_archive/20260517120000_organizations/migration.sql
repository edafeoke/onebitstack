-- Organization workspaces for shared VPS/projects among GitHub org members.

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "githubId" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_kind_idx" ON "Organization"("kind");

CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- Server.organizationId
ALTER TABLE "Server" ADD COLUMN "organizationId" TEXT;

-- Project.organizationId
ALTER TABLE "Project" ADD COLUMN "organizationId" TEXT;

-- GitHubAppInstallation.organizationId (replace per-user ownership)
ALTER TABLE "GitHubAppInstallation" ADD COLUMN "organizationId" TEXT;

-- Personal workspace per user + backfill Server/Project
INSERT INTO "Organization" ("id", "slug", "name", "githubId", "kind", "createdAt", "updatedAt")
SELECT
    'org_' || "id",
    'user-' || "id",
    COALESCE(NULLIF(trim("name"), ''), "email"),
    NULL,
    'user',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "user";

INSERT INTO "OrganizationMember" ("id", "organizationId", "userId", "role", "createdAt")
SELECT
    'om_' || "id",
    'org_' || "id",
    "id",
    'admin',
    CURRENT_TIMESTAMP
FROM "user";

UPDATE "Server" SET "organizationId" = 'org_' || "userId" WHERE "organizationId" IS NULL;
UPDATE "Project" SET "organizationId" = 'org_' || "userId" WHERE "organizationId" IS NULL;

-- GitHub org/user workspaces from existing installations
INSERT INTO "Organization" ("id", "slug", "name", "githubId", "kind", "createdAt", "updatedAt")
SELECT
    'org_gh_' || lower("accountLogin"),
    lower("accountLogin"),
    "accountLogin",
    NULL,
    CASE WHEN "accountType" = 'Organization' THEN 'organization' ELSE 'user' END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "GitHubAppInstallation"
WHERE NOT EXISTS (
    SELECT 1 FROM "Organization" o WHERE o."slug" = lower("GitHubAppInstallation"."accountLogin")
);

UPDATE "GitHubAppInstallation"
SET "organizationId" = (
    SELECT o."id" FROM "Organization" o
    WHERE o."slug" = lower("GitHubAppInstallation"."accountLogin")
    LIMIT 1
)
WHERE "organizationId" IS NULL;

-- Org installers become members of the installation workspace
INSERT INTO "OrganizationMember" ("id", "organizationId", "userId", "role", "createdAt")
SELECT
    'om_inst_' || g."id",
    g."organizationId",
    g."userId",
    'admin',
    CURRENT_TIMESTAMP
FROM "GitHubAppInstallation" g
WHERE g."organizationId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "OrganizationMember" m
    WHERE m."organizationId" = g."organizationId" AND m."userId" = g."userId"
  );

-- Move servers/projects to GitHub org workspace when installer had org-type installation
UPDATE "Server"
SET "organizationId" = (
    SELECT g."organizationId"
    FROM "GitHubAppInstallation" g
    WHERE g."userId" = "Server"."userId"
      AND g."accountType" = 'Organization'
      AND g."organizationId" IS NOT NULL
    ORDER BY g."createdAt" DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM "GitHubAppInstallation" g
    WHERE g."userId" = "Server"."userId"
      AND g."accountType" = 'Organization'
      AND g."organizationId" IS NOT NULL
);

UPDATE "Project"
SET "organizationId" = (
    SELECT s."organizationId" FROM "Server" s WHERE s."id" = "Project"."serverId"
)
WHERE EXISTS (
    SELECT 1 FROM "Server" s WHERE s."id" = "Project"."serverId"
);

-- Enforce NOT NULL and swap installation FK
CREATE TABLE "new_GitHubAppInstallation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "installerGithubId" TEXT,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GitHubAppInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_GitHubAppInstallation" (
    "id", "installationId", "organizationId", "accountLogin", "accountType",
    "installerGithubId", "suspended", "createdAt", "updatedAt"
)
SELECT
    "id", "installationId", "organizationId", "accountLogin", "accountType",
    "installerGithubId", "suspended", "createdAt", "updatedAt"
FROM "GitHubAppInstallation"
WHERE "organizationId" IS NOT NULL;

DROP TABLE "GitHubAppInstallation";
ALTER TABLE "new_GitHubAppInstallation" RENAME TO "GitHubAppInstallation";
CREATE UNIQUE INDEX "GitHubAppInstallation_installationId_key" ON "GitHubAppInstallation"("installationId");
CREATE INDEX "GitHubAppInstallation_organizationId_idx" ON "GitHubAppInstallation"("organizationId");

-- Server / Project constraints
CREATE TABLE "new_Server" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "sshUser" TEXT NOT NULL,
    "sshPrivateKeyCipher" TEXT NOT NULL,
    "sshPrivateKeyIv" TEXT NOT NULL,
    "sshPrivateKeyTag" TEXT NOT NULL,
    "webStack" TEXT NOT NULL DEFAULT 'none',
    "reverseProxyNotes" TEXT NOT NULL DEFAULT '',
    "tlsCertPath" TEXT NOT NULL DEFAULT '',
    "tlsKeyPath" TEXT NOT NULL DEFAULT '',
    "reverseProxyConfigPath" TEXT NOT NULL DEFAULT '',
    "capabilitiesJson" TEXT NOT NULL DEFAULT '',
    "lastCapabilityProbeAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Server_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Server_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Server" SELECT * FROM "Server" WHERE "organizationId" IS NOT NULL;
DROP TABLE "Server";
ALTER TABLE "new_Server" RENAME TO "Server";
CREATE INDEX "Server_userId_idx" ON "Server"("userId");
CREATE INDEX "Server_organizationId_idx" ON "Server"("organizationId");

CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Project" SELECT * FROM "Project" WHERE "organizationId" IS NOT NULL;
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");
CREATE INDEX "Project_serverId_idx" ON "Project"("serverId");
CREATE INDEX "Project_repository_idx" ON "Project"("repository");
CREATE UNIQUE INDEX "Project_serverId_port_key" ON "Project"("serverId", "port");
