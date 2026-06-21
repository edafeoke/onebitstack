-- Migrate legacy OrganizationMember roles to four-role RBAC.
-- admin (legacy workspace admin) -> admin; member -> developer
UPDATE "OrganizationMember" SET role = 'developer' WHERE role = 'member';
-- Personal workspaces: first admin per org becomes owner where kind = user
UPDATE "OrganizationMember"
SET role = 'owner'
WHERE role = 'admin'
  AND organizationId IN (SELECT id FROM "Organization" WHERE kind = 'user');
