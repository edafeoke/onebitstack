import "dotenv/config";
import { defineConfig } from "prisma/config";

function resolveSchemaPath(): string {
  const provider =
    process.env.CENTRAL_DATABASE_PROVIDER?.trim().toLowerCase() ?? "postgresql";
  return provider === "sqlite"
    ? "prisma/schema.sqlite.prisma"
    : "prisma/schema.postgresql.prisma";
}

export default defineConfig({
  schema: resolveSchemaPath(),
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: process.env.DATABASE_URL
  }
});
