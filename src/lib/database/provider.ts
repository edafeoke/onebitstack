export type DatabaseProvider = "postgresql" | "sqlite";

export function getDatabaseProvider(): DatabaseProvider {
  const raw = process.env.CENTRAL_DATABASE_PROVIDER?.trim().toLowerCase();
  if (raw === "sqlite") return "sqlite";
  return "postgresql";
}

export function isSqliteTrialMode(): boolean {
  return getDatabaseProvider() === "sqlite";
}

export function defaultSqliteDatabaseUrl(): string {
  return "file:./data/central.db";
}

export function defaultPostgresDatabaseUrl(): string {
  return "postgresql://central:central@127.0.0.1:5432/central?schema=central";
}

export function buildEnvSnippetForDatabase(opts: {
  provider: DatabaseProvider;
  databaseUrl: string;
  origin?: string;
}): string {
  const lines = [
    `CENTRAL_DATABASE_PROVIDER=${opts.provider}`,
    `DATABASE_URL=${opts.databaseUrl}`
  ];
  if (opts.origin) {
    lines.push(`NEXT_PUBLIC_APP_URL=${opts.origin}`, `BETTER_AUTH_URL=${opts.origin}`);
  }
  return lines.join("\n");
}
