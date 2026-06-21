"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GithubAppSetupStatus } from "@/lib/github-app/setup";

type Props = {
  status: GithubAppSetupStatus;
  setupAllowed: boolean;
  saasMode: boolean;
  appSlug?: string | null;
  backHref?: string;
};

export function GithubAppSetupPanel({
  status,
  setupAllowed,
  saasMode,
  appSlug,
  backHref = "/setup"
}: Props) {
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyOk, setVerifyOk] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [manual, setManual] = useState({
    appId: "",
    clientId: "",
    clientSecret: "",
    webhookSecret: "",
    appSlug: "",
    privateKey: ""
  });

  const runVerify = useCallback(
    async (useDraft: boolean) => {
      setPending(true);
      setVerifyMsg(null);
      setVerifyOk(null);
      try {
        const res = await fetch("/api/setup/github/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            useDraft
              ? { ...manual, useDraft: true }
              : { useDraft: false }
          )
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          slug?: string;
          name?: string;
        };
        if (data.ok) {
          setVerifyOk(true);
          setVerifyMsg(
            `Verified${data.name ? `: ${data.name}` : ""}${data.slug ? ` (@${data.slug})` : ""}. Restart the app if you updated .env.`
          );
        } else {
          setVerifyOk(false);
          setVerifyMsg(data.error ?? "Verification failed");
        }
      } catch (e) {
        setVerifyOk(false);
        setVerifyMsg(e instanceof Error ? e.message : "Request failed");
      } finally {
        setPending(false);
      }
    },
    [manual]
  );

  const saveDraft = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/setup/github/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manual)
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setVerifyOk(false);
        setVerifyMsg(data.error ?? "Could not save draft");
        return;
      }
      await runVerify(true);
    } finally {
      setPending(false);
    }
  };

  const generateSecret = async () => {
    const res = await fetch("/api/setup/github/secret", { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { secret?: string };
      if (data.secret) {
        setManual((m) => ({ ...m, webhookSecret: data.secret! }));
      }
    }
  };

  if (saasMode) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          GitHub App credentials are configured by your host operator. Use Settings to install the
          app on your organization.
        </p>
        <Button variant="outline" size="sm" render={<Link href="/dashboard/settings" />}>
          Open Settings
        </Button>
      </div>
    );
  }

  if (status.configured) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-emerald-400">GitHub App is configured on this server.</p>
        {status.missing.length > 0 ? (
          <p className="text-amber-300">Optional fields missing: {status.missing.join(", ")}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => runVerify(false)}
          >
            Re-verify
          </Button>
          {appSlug ? (
            <Button
              size="sm"
              variant="outline"
              render={
                <a
                  href={`https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              Install on GitHub
            </Button>
          ) : null}
        </div>
        {verifyMsg ? (
          <p className={verifyOk ? "text-emerald-400" : "text-destructive"}>{verifyMsg}</p>
        ) : null}
      </div>
    );
  }

  if (!setupAllowed) {
    return (
      <p className="text-muted-foreground text-sm">
        Sign in as a platform admin to configure the GitHub App for this instance.
      </p>
    );
  }

  return (
    <div className="space-y-6 text-sm">
      <div className="space-y-2">
        <p className="text-foreground font-medium">Endpoints (use in GitHub App settings)</p>
        <ul className="text-muted-foreground space-y-1 font-mono text-xs">
          <li>Webhook: POST {status.publicUrls.webhook}</li>
          <li>OAuth callback: {status.publicUrls.oauthCallback}</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/api/setup/github/manifest" />}>Create GitHub App on GitHub</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => runVerify(false)}>
          Verify current .env
        </Button>
      </div>

      <div className="border-border space-y-3 rounded-lg border p-4">
        <p className="text-foreground font-medium">Manual credentials</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="gh-app-id">App ID</Label>
            <Input
              id="gh-app-id"
              value={manual.appId}
              onChange={(e) => setManual((m) => ({ ...m, appId: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gh-slug">App slug</Label>
            <Input
              id="gh-slug"
              value={manual.appSlug}
              onChange={(e) => setManual((m) => ({ ...m, appSlug: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gh-client-id">Client ID</Label>
            <Input
              id="gh-client-id"
              value={manual.clientId}
              onChange={(e) => setManual((m) => ({ ...m, clientId: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gh-client-secret">Client secret</Label>
            <Input
              id="gh-client-secret"
              type="password"
              value={manual.clientSecret}
              onChange={(e) => setManual((m) => ({ ...m, clientSecret: e.target.value }))}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="gh-webhook-secret">Webhook secret</Label>
            <div className="flex gap-2">
              <Input
                id="gh-webhook-secret"
                type="password"
                value={manual.webhookSecret}
                onChange={(e) => setManual((m) => ({ ...m, webhookSecret: e.target.value }))}
              />
              <Button type="button" variant="outline" size="sm" onClick={generateSecret}>
                Generate
              </Button>
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="gh-pem">Private key (PEM)</Label>
            <textarea
              id="gh-pem"
              rows={6}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:ring-2 focus-visible:outline-none"
              value={manual.privateKey}
              onChange={(e) => setManual((m) => ({ ...m, privateKey: e.target.value }))}
              placeholder="-----BEGIN RSA PRIVATE KEY-----"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={saveDraft}>
            Save draft & verify
          </Button>
        </div>
      </div>

      {verifyMsg ? (
        <p className={verifyOk ? "text-emerald-400" : "text-destructive"}>{verifyMsg}</p>
      ) : null}

      <p className="text-muted-foreground text-xs">
        After manifest creation or manual entry, copy credentials into <code>.env</code> and restart,
        or run <code>central-cli github-app apply</code> on the VPS.{" "}
        <Link href={backHref} className="text-primary underline">
          Back
        </Link>
      </p>
    </div>
  );
}
