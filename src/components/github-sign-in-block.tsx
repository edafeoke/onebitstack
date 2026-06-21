"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "@/components/github-icon";
import { fetchAuthFeatures, type AuthFeatures, signInWithGithub } from "@/lib/github-oauth-client";

export function GithubSignInBlock({
  defaultCallback = "/dashboard"
}: {
  defaultCallback?: string;
}) {
  const [features, setFeatures] = useState<AuthFeatures | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchAuthFeatures().then(setFeatures);
  }, []);

  async function onClick() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("callbackUrl") ?? defaultCallback;
    const callbackURL = raw.startsWith("/") ? raw : `/${raw.replace(/^\/+/, "")}`;
    setError(null);
    setPending(true);
    try {
      await signInWithGithub(callbackURL);
    } catch (e) {
      setError(e instanceof Error ? e.message : "GitHub connection failed");
      setPending(false);
    }
  }

  if (features === null) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="outline" className="w-full gap-2" disabled>
          <GithubIcon />
          Continue with GitHub…
        </Button>
      </div>
    );
  }

  const enabled = features.githubLogin;
  const anyAuth = features.githubLogin || features.credentialAuth;

  return (
    <div className="space-y-3">
      {!enabled && !anyAuth ? (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          <p className="font-medium">No sign-in methods configured</p>
          <p className="mt-1 text-xs">
            Enable credentials auth or configure GitHub OAuth on this instance.
          </p>
        </div>
      ) : !enabled ? (
        <p className="text-muted-foreground text-center text-xs">
          GitHub is not configured on this instance. Use email sign-in, or ask your operator to set{" "}
          <code className="font-mono">GITHUB_CLIENT_ID</code> and{" "}
          <code className="font-mono">GITHUB_CLIENT_SECRET</code>.
        </p>
      ) : null}
      {enabled ? (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          disabled={pending}
          onClick={() => void onClick()}
        >
          <GithubIcon />
          {pending ? "Redirecting…" : "Continue with GitHub"}
        </Button>
      ) : null}
      {error ? <p className="text-destructive text-center text-sm">{error}</p> : null}
    </div>
  );
}
