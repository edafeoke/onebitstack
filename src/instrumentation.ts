import { collectProductionMisconfigs } from "@/lib/production/config";

export async function register(): Promise<void> {
  const issues = collectProductionMisconfigs();
  for (const issue of issues) {
    console.warn(`[central-server] production misconfig (${issue.code}): ${issue.message}`);
  }
}
