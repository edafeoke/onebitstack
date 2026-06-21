import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildEnvSnippetForDatabase,
  defaultPostgresDatabaseUrl,
  defaultSqliteDatabaseUrl,
  type DatabaseProvider
} from "@/lib/database/provider";
import { resolvePublicBaseUrl } from "@/lib/github-app/setup";

const schema = z.object({
  provider: z.enum(["postgresql", "sqlite"]),
  delivery: z.enum(["docker", "external", "skip"]).optional(),
  databaseUrl: z.string().optional(),
  sqlitePath: z.string().optional()
});

export async function POST(request: Request): Promise<Response> {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid database configuration." }, { status: 400 });
  }

  const { provider, delivery, databaseUrl, sqlitePath } = parsed.data;
  const origin = resolvePublicBaseUrl();

  let url: string;
  let instructions: string;

  if (provider === "sqlite") {
    const path = sqlitePath?.trim() || "./data/central.db";
    url = databaseUrl?.trim() || `file:${path}`;
    instructions =
      "SQLite is for local trial only. After pasting into .env, run: npx prisma db push && restart the app.";
  } else {
    url =
      databaseUrl?.trim() ||
      (delivery === "docker"
        ? defaultPostgresDatabaseUrl()
        : defaultPostgresDatabaseUrl());
    if (delivery === "docker") {
      instructions =
        "Start bundled Postgres: docker compose -f docker-compose.install.yml up -d. Then run: npx prisma migrate deploy (or npm run db:bootstrap) and restart.";
    } else if (delivery === "external") {
      instructions = "Set your managed Postgres URL, then run: npx prisma migrate deploy and restart.";
    } else {
      instructions = "Ensure DATABASE_URL is set, then run: npx prisma migrate deploy and restart.";
    }
  }

  const envBlock = buildEnvSnippetForDatabase({
    provider: provider as DatabaseProvider,
    databaseUrl: url,
    origin
  });

  return NextResponse.json({
    ok: true,
    provider,
    envBlock,
    instructions,
    trialWarning:
      provider === "sqlite"
        ? "SQLite is not recommended for production multi-tenant use."
        : undefined
  });
}
