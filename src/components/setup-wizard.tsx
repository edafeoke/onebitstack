"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyGithubDraftToEnv,
  createSetupAdmin,
  saveSetupPublicUrl,
  type SetupActionResult
} from "@/app/setup/actions";
import { GithubAppSetupPanel } from "@/components/github-app-setup-panel";
import { DatabaseSetupPanel } from "@/components/database-setup-panel";
import type { GithubAppSetupStatus } from "@/lib/github-app/setup";

type SetupStatus = {
  completed: boolean;
  repairMode: boolean;
  credentialAuth: boolean;
  saasMode?: boolean;
  database: { ok: boolean; message: string; provider?: string };
  redis: { ok: boolean; message: string; skipped?: boolean };
  githubApp?: GithubAppSetupStatus & { setupAllowed?: boolean };
};

export function SetupWizard({ initial }: { initial: SetupStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [envMsg, setEnvMsg] = useState<string | null>(null);
  const [githubEnvMsg, setGithubEnvMsg] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<
    SetupActionResult | null,
    FormData
  >(createSetupAdmin, null);
  const [urlState, urlAction, urlPending] = useActionState<
    SetupActionResult | null,
    FormData
  >(saveSetupPublicUrl, null);

  const refreshStatus = () =>
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((s: SetupStatus) => setStatus(s))
      .catch(() => {});

  useEffect(() => {
    void refreshStatus();
  }, [state, urlState]);

  useEffect(() => {
    if (state?.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (urlState?.ok) setEnvMsg("Saved public URL to .env — restart the app if it is already running.");
    else if (urlState && !urlState.ok) setEnvMsg(urlState.error);
  }, [urlState]);

  async function onApplyGithubEnv() {
    setGithubEnvMsg(null);
    const res = await applyGithubDraftToEnv();
    if (res.ok) {
      setGithubEnvMsg("GitHub App credentials written to .env. Run: central-cli doctor && sudo systemctl restart central-server");
      void refreshStatus();
    } else {
      setGithubEnvMsg(res.error);
    }
  }

  if (status.completed && !status.repairMode) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Setup complete</h1>
        <p className="text-muted-foreground text-sm">
          This instance is already configured. Sign in to open the dashboard.
        </p>
        <Button render={<Link href="/login" />}>Sign in</Button>
      </div>
    );
  }

  const defaultOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://central.example.com";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {status.repairMode ? "Setup repair" : "Control plane setup"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Step through health checks, public URL, admin account, and GitHub App configuration.
          Required on first install.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">1. Health checks</h2>
        <ul className="space-y-1 text-sm">
          <li className={status.database.ok ? "text-green-500" : "text-destructive"}>
            Database: {status.database.message}
          </li>
          <li className={status.redis.ok ? "text-green-500" : "text-destructive"}>
            Redis: {status.redis.message}
          </li>
        </ul>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              fetch("/api/setup/check-database", { method: "POST" }).then(refreshStatus)
            }
          >
            Re-check database
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              fetch("/api/setup/check-redis", { method: "POST" }).then(refreshStatus)
            }
          >
            Re-check Redis
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">2. Database snippet</h2>
        <DatabaseSetupPanel currentProvider={status.database.provider} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">3. Public URL</h2>
        <p className="text-muted-foreground text-xs">
          Used for auth callbacks and GitHub webhooks. Written to <code>.env</code> on this server.
        </p>
        <form action={urlAction} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[280px] flex-1 space-y-1">
            <Label htmlFor="publicUrl">Public URL</Label>
            <Input
              id="publicUrl"
              name="publicUrl"
              type="url"
              required
              defaultValue={defaultOrigin}
              placeholder="https://central.example.com"
            />
          </div>
          <Button type="submit" size="sm" disabled={urlPending}>
            {urlPending ? "Saving…" : "Save to .env"}
          </Button>
        </form>
        {envMsg ? (
          <p className={urlState?.ok ? "text-green-500 text-xs" : "text-destructive text-xs"}>
            {envMsg}
          </p>
        ) : null}
      </section>

      {status.credentialAuth && !status.completed && (
        <form action={formAction} className="space-y-4">
          <h2 className="text-sm font-medium">4. Platform admin</h2>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {state && !state.ok && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}
          <Button type="submit" disabled={pending || !status.database.ok}>
            {pending ? "Creating…" : "Create admin account"}
          </Button>
        </form>
      )}

      {status.completed && status.repairMode && (
        <p className="text-muted-foreground text-sm">
          Repair mode: admin account already exists.
        </p>
      )}

      {status.githubApp && !status.saasMode ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">5. GitHub App (this server)</h2>
          <GithubAppSetupPanel
            status={status.githubApp}
            setupAllowed={status.githubApp.setupAllowed ?? true}
            saasMode={status.saasMode ?? false}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => void onApplyGithubEnv()}>
            Write GitHub credentials to .env
          </Button>
          {githubEnvMsg ? (
            <p
              className={
                githubEnvMsg.startsWith("GitHub")
                  ? "text-green-500 text-xs"
                  : "text-destructive text-xs"
              }
            >
              {githubEnvMsg}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">6. Verify & start</h2>
        <p className="text-muted-foreground text-xs">
          On the VPS shell: <code className="text-foreground">central-cli doctor</code> then{" "}
          <code className="text-foreground">sudo systemctl restart central-server central-deploy-worker</code>
        </p>
      </section>
    </div>
  );
}
