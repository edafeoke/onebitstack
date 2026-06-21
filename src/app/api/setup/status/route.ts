import { NextResponse } from "next/server";
import { getSession } from "@/lib/require-session";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { isCredentialAuthEnabled, isSaasMode } from "@/lib/auth-config";
import { getSetupState, isSetupCompleted } from "@/lib/setup-state";
import { checkDatabase, checkRedis } from "@/lib/setup-checks";
import { getGithubAppSetupStatus } from "@/lib/github-app/setup";
import { getDatabaseProvider } from "@/lib/database/provider";

export async function GET() {
  const completed = await isSetupCompleted();
  const state = await getSetupState();
  const session = await getSession();
  const repairMode = completed && session?.user
    ? await isPlatformAdmin(session.user.id)
    : false;

  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const githubApp = getGithubAppSetupStatus();

  return NextResponse.json({
    completed,
    repairMode,
    saasMode: isSaasMode(),
    credentialAuth: isCredentialAuthEnabled(),
    adminUserId: state?.adminUserId ?? null,
    database,
    redis,
    githubApp: {
      ...githubApp,
      setupAllowed: !isSaasMode() && (githubApp.configured === false || repairMode)
    },
    databaseProvider: getDatabaseProvider()
  });
}
