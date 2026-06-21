-- Run once as PostgreSQL superuser (e.g. postgres) on database centralserver:
--   psql -U postgres -d centralserver -f prisma/postgres-grants.sql
--
-- Required when the app user cannot create objects in schema public (PostgreSQL 15+).
-- Alternative (no superuser): npm run db:bootstrap — creates tables in schema `central`.
-- Verify after grants or bootstrap: npm run db:verify

-- Option A: Prisma migrations in schema public (replace centraluser with your role)
GRANT ALL ON SCHEMA public TO centraluser;
GRANT CREATE ON SCHEMA public TO centraluser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO centraluser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO centraluser;

-- Option B: Application tables in schema central (used by db:bootstrap)
GRANT USAGE ON SCHEMA central TO centraluser;
GRANT ALL ON SCHEMA central TO centraluser;
GRANT ALL ON ALL TABLES IN SCHEMA central TO centraluser;
GRANT ALL ON ALL SEQUENCES IN SCHEMA central TO centraluser;
ALTER DEFAULT PRIVILEGES IN SCHEMA central GRANT ALL ON TABLES TO centraluser;
ALTER DEFAULT PRIVILEGES IN SCHEMA central GRANT ALL ON SEQUENCES TO centraluser;
