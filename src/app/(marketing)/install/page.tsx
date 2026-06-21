import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicAppName } from "@/lib/app-config";

export default function InstallPage() {
  const appName = getPublicAppName();
  const installBase =
    process.env.NEXT_PUBLIC_INSTALL_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://your-central.example.com";
  const base = installBase.replace(/\/+$/, "");

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Install {appName}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Run the control plane on your VPS. The public website is separate — this installs the full
        deployment dashboard on infrastructure you control.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick install (recommended)</CardTitle>
          <CardDescription>Bundled Postgres + Redis via Docker on Ubuntu/Debian</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
            {`curl -fsSL ${base}/install.sh | bash -s -- \\
  --domain your-central.example.com \\
  --database postgresql \\
  --postgres docker`}
          </pre>
          <p className="text-muted-foreground text-xs">
            After install, open <code className="text-foreground">https://your-central.example.com/setup</code>{" "}
            to create the first admin and configure GitHub.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>CLI install</CardTitle>
          <CardDescription>Same installer, explicit flags</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
            {`curl -fsSL ${base}/install.sh | bash -s -- --help
central-cli install --domain your-central.example.com --postgres docker
central-cli doctor`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Docker all-in-one</CardTitle>
          <CardDescription>Postgres, Redis, app, and worker in Compose</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
            {`git clone https://github.com/centralstack/central-server.git
cd central-server
cp .env.production.example .env
docker compose -f docker-compose.install.yml --profile app up -d`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Install flags</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          <ul className="list-inside list-disc space-y-1">
            <li>
              <code className="text-foreground">--domain</code> — public URL for auth and webhooks
            </li>
            <li>
              <code className="text-foreground">--database postgresql|sqlite</code>
            </li>
            <li>
              <code className="text-foreground">--postgres docker|external|skip</code>
            </li>
            <li>
              <code className="text-foreground">--no-interactive</code> — CI / scripted installs
            </li>
            <li>
              <code className="text-foreground">--systemd</code> — install systemd units (default when root)
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button render={<Link href="/docs/get-started/installation" />}>Full installation guide</Button>
        <Button variant="outline" render={<Link href="/docs/deploy/website" />}>
          Deploy this website to Vercel
        </Button>
      </div>
    </main>
  );
}
