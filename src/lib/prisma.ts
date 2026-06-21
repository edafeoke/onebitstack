import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { getDatabaseProvider } from "@/lib/database/provider";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const provider = getDatabaseProvider();
  if (provider === "sqlite") {
    const adapter = new PrismaBetterSqlite3({ url: connectionString });
    return new PrismaClient({ adapter });
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

let client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!client) {
    client = createPrismaClient();
  }
  return client;
}

/** Reconnect after a dropped pool connection. */
export async function reconnectPrisma(): Promise<PrismaClient> {
  if (client) {
    await client.$disconnect().catch(() => {});
  }
  client = createPrismaClient();
  return client;
}

/** Detect SQLite file moved/replaced while the app still has the DB open. */
export function isSqliteReadonlyDbMoved(err: unknown): boolean {
  if (getDatabaseProvider() !== "sqlite") return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /SQLITE_READONLY_DBMOVED|readonly database moved/i.test(msg);
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const current = getPrisma() as object;
    const value = Reflect.get(current, prop);
    if (typeof value === "function") {
      return (...args: unknown[]) =>
        (value as (...a: unknown[]) => unknown).apply(current, args);
    }
    return value;
  }
});
