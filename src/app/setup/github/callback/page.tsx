import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  exchangeManifestCode,
  encodeSignedJson
} from "@/lib/github-app/setup";
import {
  canAccessGithubAppSetup,
  consumeManifestStateCookie,
  setDraftCredentialsCookie
} from "@/lib/github-app/setup-auth";

type PageProps = {
  searchParams: Promise<{ code?: string; state?: string; error?: string; error_description?: string }>;
};

export default async function GithubManifestCallbackPage({ searchParams }: PageProps) {
  if (!(await canAccessGithubAppSetup())) {
    redirect("/setup");
  }

  const params = await searchParams;

  if (params.error) {
    return (
      <CallbackShell>
        <h1 className="text-xl font-semibold text-destructive">GitHub App registration failed</h1>
        <p className="text-muted-foreground text-sm">
          {params.error_description ?? params.error}
        </p>
        <Button render={<Link href="/setup" />}>Back to setup</Button>
      </CallbackShell>
    );
  }

  const code = params.code?.trim();
  const state = params.state?.trim() ?? null;
  if (!code) {
    return (
      <CallbackShell>
        <h1 className="text-xl font-semibold">Missing authorization code</h1>
        <p className="text-muted-foreground text-sm">Start again from the setup wizard.</p>
        <Button render={<Link href="/setup" />}>Back to setup</Button>
      </CallbackShell>
    );
  }

  const stateOk = await consumeManifestStateCookie(state);
  if (!stateOk) {
    return (
      <CallbackShell>
        <h1 className="text-xl font-semibold">Invalid or expired session</h1>
        <p className="text-muted-foreground text-sm">
          The setup session expired. Create the app again from setup.
        </p>
        <Button render={<Link href="/api/setup/github/manifest" />}>Create GitHub App</Button>
      </CallbackShell>
    );
  }

  const result = await exchangeManifestCode(code);
  if (!result.ok) {
    return (
      <CallbackShell>
        <h1 className="text-xl font-semibold text-destructive">Could not complete registration</h1>
        <p className="text-muted-foreground text-sm">{result.error}</p>
        <Button render={<Link href="/setup" />}>Back to setup</Button>
      </CallbackShell>
    );
  }

  await setDraftCredentialsCookie(encodeSignedJson(result.credentials));

  const filename = "central-github.env";
  const downloadBody = result.envBlock;

  return (
    <CallbackShell>
      <h1 className="text-xl font-semibold text-emerald-400">GitHub App created</h1>
      <p className="text-muted-foreground text-sm">
        App <strong className="text-foreground">{result.credentials.name}</strong> (
        {result.credentials.appSlug || "slug pending"}). Copy the block below into your server{" "}
        <code className="text-foreground">.env</code>, then restart the app.
      </p>
      <pre className="bg-muted max-h-80 overflow-auto rounded-md p-3 text-left text-xs">
        {downloadBody}
      </pre>
      <div className="flex flex-wrap justify-center gap-2">
        <Button render={<Link href="/setup" />}>Continue setup</Button>
        <Button variant="outline" render={<Link href="/dashboard/admin/github" />}>
          Platform admin
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Or run <code className="text-foreground">central-cli github-app apply</code> on the VPS to
        merge into <code className="text-foreground">.env</code>.
      </p>
      <a
        href={`data:text/plain;charset=utf-8,${encodeURIComponent(downloadBody)}`}
        download={filename}
        className="text-primary text-sm underline"
      >
        Download {filename}
      </a>
      {result.credentials.appSlug ? (
        <p className="text-muted-foreground text-xs">
          Install on your org:{" "}
          <a
            href={`https://github.com/apps/${encodeURIComponent(result.credentials.appSlug)}/installations/new`}
            className="text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            GitHub → Install App
          </a>
        </p>
      ) : null}
    </CallbackShell>
  );
}

function CallbackShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-16 text-center">{children}</main>
  );
}
