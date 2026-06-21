import { z } from "zod";
import { normalizeDeployRoot } from "@/lib/server-layout";

export const webStackSchema = z.enum(["none", "nginx", "apache", "caddy"]);

export const pathFieldSchema = z.string().max(2048).optional();

export const deployRootFieldSchema = z
  .string()
  .max(512)
  .optional()
  .refine((p) => !p?.trim() || p.trim().startsWith("/"), "Deploy root must be an absolute path")
  .refine((p) => !p?.includes(".."), "Deploy root must not contain ..")
  .transform((p) => normalizeDeployRoot(p));

export const serverBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(128),
  host: z.string().min(1, "Host is required").max(255),
  sshUser: z.string().min(1, "SSH user is required").max(64),
  webStack: webStackSchema.default("none"),
  deployRoot: deployRootFieldSchema,
  reverseProxyNotes: z.string().max(16_000).optional(),
  tlsCertPath: pathFieldSchema,
  tlsKeyPath: pathFieldSchema,
  reverseProxyConfigPath: pathFieldSchema
});

export type ServerFormValues = z.infer<typeof serverBaseSchema> & {
  sshPrivateKey?: string;
};

export const createServerFormSchema = serverBaseSchema.extend({
  sshPrivateKey: z.string().min(1, "Private key is required")
});

export const updateServerFormSchema = serverBaseSchema.extend({
  sshPrivateKey: z.string().optional()
});

export const projectPortSchema = z
  .number()
  .int()
  .positive()
  .max(65535)
  .optional();
