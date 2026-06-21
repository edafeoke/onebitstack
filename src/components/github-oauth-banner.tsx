"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAuthFeatures, type AuthFeatures } from "@/lib/github-oauth-client";

export function GithubOAuthBanner() {
  const [features, setFeatures] = useState<AuthFeatures | null>(null);

  useEffect(() => {
    void fetchAuthFeatures().then(setFeatures);
  }, []);

  if (features === null) {
    return null;
  }

  if (features.githubLogin) {
    return null;
  }

  if (features.credentialAuth) {
    return (
      <div
        role="status"
        className="border-border bg-muted/50 text-muted-foreground mb-4 rounded-lg border px-4 py-3 text-sm"
      >
        <p className="text-foreground font-medium">Connect GitHub for repos and push-to-deploy</p>
        <p className="mt-1">
          Your account works with email. To import repositories and enable automatic deploys on push,{" "}
          <Link href="/dashboard/settings" className="text-primary font-medium underline">
            connect GitHub in Settings
          </Link>{" "}
          once OAuth is enabled on this instance.
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="border-destructive/50 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm"
    >
      <p className="font-medium">Sign-in is not configured</p>
      <p className="text-destructive/90 mt-1">
        Enable credential auth or set GitHub OAuth credentials, then restart the server.
      </p>
    </div>
  );
}
