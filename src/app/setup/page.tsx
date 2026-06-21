import { SetupWizard } from "@/components/setup-wizard";
import { isCredentialAuthEnabled, isSaasMode } from "@/lib/auth-config";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { getGithubAppSetupStatus } from "@/lib/github-app/setup";
import { checkDatabase, checkRedis } from "@/lib/setup-checks";
import { getSession } from "@/lib/require-session";
import { isSetupCompleted } from "@/lib/setup-state";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [completed, database, redis, session] = await Promise.all([
    isSetupCompleted(),
    checkDatabase(),
    checkRedis(),
    getSession()
  ]);

  const repairMode =
    completed && session?.user ? await isPlatformAdmin(session.user.id) : false;

  const githubApp = getGithubAppSetupStatus();

  return (
    <SetupWizard
      initial={{
        completed,
        repairMode,
        credentialAuth: isCredentialAuthEnabled(),
        saasMode: isSaasMode(),
        database,
        redis,
        githubApp: {
          ...githubApp,
          setupAllowed: !isSaasMode() && (!githubApp.configured || repairMode || !completed)
        }
      }}
    />
  );
}
