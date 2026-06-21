/**
 * Bootstrap PostgreSQL when the app user cannot CREATE in schema `public` (PG 15+).
 * Creates tables in schema `central` and marks the baseline migration applied.
 *
 * Usage: npx tsx prisma/bootstrap-central-schema.ts
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { getDatabaseProvider } from "../src/lib/database/provider";

const MIGRATION_NAME = "20260518120000_postgresql_init";
const MIGRATION_DIR = join(process.cwd(), "prisma/migrations", MIGRATION_NAME);

async function main(): Promise<void> {
  if (getDatabaseProvider() === "sqlite") {
    console.log("db:bootstrap skipped — not applicable for SQLite (use: npx prisma db push)");
    return;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const migrationPath = join(MIGRATION_DIR, "migration.sql");
  let sql = readFileSync(migrationPath, "utf8");
  sql = sql
    .replace(/^-- CreateSchema\r?\nCREATE SCHEMA IF NOT EXISTS "public";\r?\n\r?\n/m, "")
    .replace(/CREATE SCHEMA IF NOT EXISTS "public";\r?\n\r?\n/g, "");

  const checksum = createHash("sha256").update(readFileSync(migrationPath, "utf8")).digest("hex");

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS central");
    await client.query("SET search_path TO central");

    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'central' AND table_name = 'user' LIMIT 1`
    );
    if (exists.rowCount && exists.rowCount > 0) {
      console.log("Schema central already has application tables.");
    } else {
      console.log("Applying baseline migration to schema central…");
      await client.query(sql);
      console.log("Schema central is ready.");
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        id VARCHAR(36) PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        finished_at TIMESTAMPTZ,
        migration_name VARCHAR(255) NOT NULL,
        logs TEXT,
        rolled_back_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        applied_steps_count INTEGER NOT NULL DEFAULT 0
      )
    `);
    const applied = await client.query(
      `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1`,
      [MIGRATION_NAME]
    );
    if (!applied.rowCount) {
      await client.query(
        `INSERT INTO "_prisma_migrations" (
          id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
        ) VALUES ($3, $1, NOW(), $2, NULL, NULL, NOW(), 1)`,
        [checksum, MIGRATION_NAME, randomUUID()]
      );
      console.log(`Recorded migration ${MIGRATION_NAME}.`);
    }

    const tables = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'central' ORDER BY tablename LIMIT 5`
    );
    console.log("Sample tables:", tables.rows.map((r) => r.tablename).join(", "));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
