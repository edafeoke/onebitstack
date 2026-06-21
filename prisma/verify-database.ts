/**
 * Verify database connectivity and that application tables exist.
 *
 * Usage: npm run db:verify
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { getDatabaseProvider } from "../src/lib/database/provider";
import { getPrisma } from "../src/lib/prisma";

async function verifyPostgres(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const schemas = await client.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name IN ('public', 'central')
       ORDER BY schema_name`
    );
    console.log("Schemas:", schemas.rows.map((r) => r.schema_name).join(", ") || "(none)");

    for (const schema of ["central", "public"]) {
      const tables = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = 'user' LIMIT 1`,
        [schema]
      );
      if (tables.rowCount && tables.rowCount > 0) {
        console.log(`OK: application tables found in schema "${schema}"`);
        return;
      }
    }

    console.error(
      "No application tables found. Run: npx prisma migrate deploy — or npm run db:bootstrap if the DB user cannot CREATE in public."
    );
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function verifySqlite(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required (e.g. file:./data/central.db)");
    process.exit(1);
  }

  const filePath = url.startsWith("file:") ? url.slice("file:".length) : url;
  const abs = resolve(process.cwd(), filePath);
  if (!existsSync(abs)) {
    console.error(`SQLite database file not found: ${abs}`);
    console.error("Run: npx prisma db push");
    process.exit(1);
  }

  console.log("SQLite file:", abs);
  const prisma = getPrisma();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const count = await prisma.user.count();
    console.log(`OK: SQLite reachable (${count} user row(s))`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const provider = getDatabaseProvider();
  console.log("Provider:", provider);
  if (provider === "sqlite") {
    await verifySqlite();
  } else {
    await verifyPostgres();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
