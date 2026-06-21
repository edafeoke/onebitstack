import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicAppName } from "@/lib/app-config";
import { isControlPlaneEdition, isWebsiteEdition } from "@/lib/edition";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/require-session";
import { isSetupCompleted } from "@/lib/setup-state";

export default async function HomePage() {
  const appName = getPublicAppName();
  const website = isWebsiteEdition();
  const controlPlane = isControlPlaneEdition();

  if (controlPlane) {
    const session = await getSession();
    if (session?.user) redirect("/dashboard");
    const done = await isSetupCompleted();
    redirect(done ? "/login" : "/setup");
  }

  const installBase =
    process.env.NEXT_PUBLIC_INSTALL_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://your-central.example.com";

  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Deploy to your VPS with {appName}
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base">
          {website
            ? "Open-source deployment control for your infrastructure. Install on your VPS, connect GitHub, and ship releases."
            : "Self-hosted deployment control for your infrastructure. Install on your server, wire GitHub, and ship releases."}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" render={<Link href="/install" />}>
            Install on your VPS
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/docs" />}>
            Read the docs
          </Button>
        </div>
      </section>

      <section className="border-border/60 border-t bg-muted/20 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Servers & agents</CardTitle>
              <CardDescription>SSH or central-agent on your VPS</CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Provision nginx, PM2, and deploy paths with capability probes and health alerts.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>GitHub-native</CardTitle>
              <CardDescription>App installs, webhooks, org workspaces</CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Connect repos when you are ready; push-to-deploy with signed webhooks.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Release deploys</CardTitle>
              <CardDescription>Atomic cutovers and rollback</CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Streaming logs, BullMQ queue with Redis, and idempotent infra generation.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold">One-command install</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
          Install the control plane on your VPS — bundled Postgres and Redis, or bring your own
          database URL.
        </p>
        <pre className="bg-muted mx-auto mt-6 max-w-xl overflow-x-auto rounded-lg p-4 text-left text-xs">
          {`curl -fsSL ${installBase.replace(/\/+$/, "")}/install.sh | bash`}
        </pre>
        <Button className="mt-6" variant="outline" render={<Link href="/install" />}>
          Installation options
        </Button>
      </section>
    </main>
  );
}
