import { z } from "zod";

export const envScopeSchema = z.enum(["production", "preview", "development"]);

export const envVarRowSchema = z.object({
  key: z.string().min(1).max(256),
  value: z.string().max(32_000),
  scope: envScopeSchema.default("production"),
  isSecret: z.boolean().default(false),
  hasSecret: z.boolean().optional()
});

export const replaceEnvVarsSchema = z.object({
  projectId: z.string().min(1),
  envVars: z.array(envVarRowSchema).max(200)
});

export const updateBranchSchema = z.object({
  projectId: z.string().min(1),
  environmentId: z.string().min(1),
  branch: z.string().min(1).max(255)
});
