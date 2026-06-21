import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import {
  isCredentialAuthEnabled,
  isGithubLoginConfigured,
  resolveAuthBaseUrl,
  resolveGithubOAuthCredentials,
  resolveTrustedOrigins
} from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

const baseURL = resolveAuthBaseUrl();
const githubOAuth = resolveGithubOAuthCredentials();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-better-auth-secret-min-32-characters-long!",
  emailAndPassword: isCredentialAuthEnabled()
    ? {
        enabled: true,
        minPasswordLength: 8,
        autoSignIn: true
      }
    : { enabled: false },
  plugins: [nextCookies()],
  baseURL,
  trustedOrigins: resolveTrustedOrigins(baseURL),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false
      }
    }
  },
  /** @see https://www.better-auth.com/docs/concepts/users-accounts#account-linking */
  account: {
    accountLinking: {
      trustedProviders: ["github", "credential"],
      requireLocalEmailVerified: false
    }
  },
  socialProviders: githubOAuth
    ? {
        github: {
          clientId: githubOAuth.clientId,
          clientSecret: githubOAuth.clientSecret,
          scope: ["read:user", "user:email", "read:org"]
        }
      }
    : undefined
});

export { isCredentialAuthEnabled, isGithubLoginConfigured } from "@/lib/auth-config";
