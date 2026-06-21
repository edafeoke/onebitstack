const DEFAULT_APP_NAME = "Central Server";

/** Server-side app name (emails, system labels). */
export function getAppName(): string {
  return (
    process.env.APP_NAME?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    DEFAULT_APP_NAME
  );
}

/** Client-safe app name (navbar, auth pages, metadata). */
export function getPublicAppName(): string {
  return (
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    process.env.APP_NAME?.trim() ||
    DEFAULT_APP_NAME
  );
}
