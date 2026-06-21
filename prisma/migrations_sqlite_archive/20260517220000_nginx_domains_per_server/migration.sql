-- One hostname per server across projects; track serverId on ProjectDomain
ALTER TABLE "ProjectDomain" ADD COLUMN "serverId" TEXT;
UPDATE "ProjectDomain"
SET "serverId" = (
  SELECT "serverId" FROM "Project" WHERE "Project"."id" = "ProjectDomain"."projectId"
);
CREATE UNIQUE INDEX "ProjectDomain_projectId_hostname_key" ON "ProjectDomain"("projectId", "hostname");
CREATE UNIQUE INDEX "ProjectDomain_hostname_serverId_key" ON "ProjectDomain"("hostname", "serverId");
CREATE INDEX "ProjectDomain_serverId_idx" ON "ProjectDomain"("serverId");
-- SQLite cannot ALTER COLUMN SET NOT NULL; enforce via application / table rebuild on Postgres deploys
