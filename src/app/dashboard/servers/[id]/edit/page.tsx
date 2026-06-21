"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPage } from "@/components/dashboard-page";
import { ServerForm } from "@/components/forms/server-form";
import { ServerSslPanel } from "@/components/server-ssl-panel";
import { DeleteServerButton } from "@/components/delete-server-button";
import type { ServerFormValues } from "@/lib/schemas/server";

type ServerRow = {
  id: string;
  name: string;
  host: string;
  sshUser: string;
  webStack: string;
  reverseProxyNotes: string;
  tlsCertPath: string;
  tlsKeyPath: string;
  reverseProxyConfigPath: string;
  deployRoot: string;
  projectCount?: number;
  canDestructive?: boolean;
};

export default function EditServerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [server, setServer] = useState<ServerRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/servers", { credentials: "include" });
      if (!res.ok) {
        setLoadError("Could not load servers");
        return;
      }
      const list = (await res.json()) as ServerRow[];
      const s = list.find((x) => x.id === id) ?? null;
      if (!s) {
        setLoadError("Server not found or access denied");
        setServer(null);
        return;
      }
      setLoadError(null);
      setServer({
        ...s,
        projectCount: s.projectCount ?? 0,
        reverseProxyNotes: s.reverseProxyNotes ?? "",
        webStack: s.webStack ?? "none",
        tlsCertPath: s.tlsCertPath ?? "",
        tlsKeyPath: s.tlsKeyPath ?? "",
        reverseProxyConfigPath: s.reverseProxyConfigPath ?? "",
        deployRoot: s.deployRoot ?? "/var/www/server"
      });
    })();
  }, [id]);

  if (loadError) {
    return (
      <DashboardPage>
        <p className="text-destructive text-sm">{loadError}</p>
        <Link href="/dashboard/servers" className={cn(buttonVariants({ variant: "ghost" }))}>
          ← Back
        </Link>
      </DashboardPage>
    );
  }

  if (!server) {
    return (
      <DashboardPage>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </DashboardPage>
    );
  }

  const formDefaults: Partial<ServerFormValues> = {
    name: server.name,
    host: server.host,
    sshUser: server.sshUser,
    webStack: (server.webStack as ServerFormValues["webStack"]) ?? "none",
    reverseProxyNotes: server.reverseProxyNotes,
    tlsCertPath: server.tlsCertPath,
    tlsKeyPath: server.tlsKeyPath,
    reverseProxyConfigPath: server.reverseProxyConfigPath,
    deployRoot: server.deployRoot
  };

  return (
    <DashboardPage>
      <Link href="/dashboard/servers" className={cn(buttonVariants({ variant: "ghost" }))}>
        ← Back
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit server</CardTitle>
          <CardDescription>
            Change host, user, or display name. Private key is optional—leave blank to keep the
            current key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ServerForm
            mode="edit"
            serverId={server.id}
            defaultValues={formDefaults}
            onSuccess={() => {
              router.push("/dashboard/servers");
              router.refresh();
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>TLS / SSL</CardTitle>
          <CardDescription>Detect, verify, or upload certificates on the VPS.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerSslPanel
            serverId={server.id}
            initialCertPath={server.tlsCertPath}
            initialKeyPath={server.tlsKeyPath}
            canDestructive={server.canDestructive ?? false}
          />
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Remove this server from Central. Projects must be deleted first.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteServerButton
            serverId={server.id}
            serverName={server.name}
            projectCount={server.projectCount ?? 0}
            canDestructive={server.canDestructive ?? false}
          />
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
