/**
 * Idempotent SQL patches when `prisma migrate deploy` cannot run (e.g. bootstrap-only DB).
 *
 * Usage: npm run db:apply-patches
 */
import "dotenv/config";
import pg from "pg";
import { getDatabaseProvider } from "../src/lib/database/provider";

const PATCHES: { name: string; sql: string }[] = [
  {
    name: "20260602120000_server_tls_cert_not_after",
    sql: `ALTER TABLE central."Server" ADD COLUMN IF NOT EXISTS "tlsCertNotAfter" TIMESTAMP(3)`
  },
  {
    name: "20260602140000_setup_state",
    sql: `
CREATE TABLE IF NOT EXISTS central.setup_state (
  id TEXT NOT NULL DEFAULT 'default',
  "completedAt" TIMESTAMP(3),
  "adminUserId" TEXT,
  "installVersion" TEXT,
  metadata JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT setup_state_pkey PRIMARY KEY (id)
)`
  }
];

async function main(): Promise<void> {
  if (getDatabaseProvider() === "sqlite") {
    console.log("db:apply-patches skipped — not applicable for SQLite (use: npx prisma db push)");
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    for (const patch of PATCHES) {
      console.log(`Applying patch ${patch.name}…`);
      await client.query(patch.sql);
      console.log(`  OK: ${patch.name}`);
    }
    console.log("Schema patches applied.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
