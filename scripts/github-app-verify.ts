import "dotenv/config";
import {
  draftToCredentials,
  getGithubAppConfig,
  getGithubAppSetupStatus,
  verifyGithubAppCredentials
} from "../src/lib/github-app/setup";

async function main(): Promise<void> {
  const status = getGithubAppSetupStatus();
  console.log("Webhook URL:", status.publicUrls.webhook);
  console.log("OAuth callback:", status.publicUrls.oauthCallback);

  const cfg = getGithubAppConfig();
  if (!cfg) {
    console.error("Missing required env vars:", status.missing.join(", "));
    process.exit(1);
  }

  const result = await verifyGithubAppCredentials(cfg);
  if (!result.ok) {
    console.error("Verify failed:", result.error);
    process.exit(1);
  }

  console.log("OK — GitHub App verified.", result.name ? `Name: ${result.name}` : "");
  if (result.slug) console.log("Slug:", result.slug);
  if (!cfg.appSlug && result.slug) {
    console.log(`Tip: add GITHUB_APP_SLUG=${result.slug}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
