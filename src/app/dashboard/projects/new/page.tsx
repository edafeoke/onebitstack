"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FrameworkBadge } from "@/components/framework-badge";
import { DashboardPage } from "@/components/dashboard-page";
import { defaultProjectDeploymentPath } from "@/lib/server-layout";
import { createProjectAction } from "../actions";

type Inst = { id: string; installationId: string; accountLogin: string; suspended: boolean };
type Repo = { fullName: string; defaultBranch: string; private: boolean };
type Branch = { name: string; protected: boolean };
type Stack = {
  framework: string;
  runtime: string;
  buildCommand: string;
  startCommand: string;
  restartCommand: string;
  hints: string[];
  pipeline: {
    id: string;
    label: string;
    description: string;
    defaultWebServer: "nginx" | null;
    needsAppPort: boolean;
  };
};
type ServerOpt = { id: string; name: string; host: string; deployRoot?: string };

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "app"
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [servers, setServers] = useState<ServerOpt[]>([]);
  const [installations, setInstallations] = useState<Inst[]>([]);
  const [installationId, setInstallationId] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repo, setRepo] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState("");
  const [stack, setStack] = useState<Stack | null>(null);
  const [override, setOverride] = useState(false);
  const [fw, setFw] = useState("");
  const [rt, setRt] = useState("");
  const [build, setBuild] = useState("");
  const [start, setStart] = useState("");
  const [restart, setRestart] = useState("");
  const [name, setName] = useState("");
  const [serverId, setServerId] = useState("");
  const [webServer, setWebServer] = useState<"nginx" | "apache" | "">("");
  const [domain, setDomain] = useState("");
  const [port, setPort] = useState<number | "">("");
  const [deploymentPath, setDeploymentPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const [sRes, iRes] = await Promise.all([
        fetch("/api/servers", { credentials: "include" }),
        fetch("/api/github/installations", { credentials: "include" })
      ]);
      if (sRes.ok) setServers((await sRes.json()) as ServerOpt[]);
      if (iRes.ok) setInstallations((await iRes.json()) as Inst[]);
    })();
  }, []);

  useEffect(() => {
    if (!installationId) {
      setRepos([]);
      setRepo("");
      return;
    }
    void (async () => {
      const res = await fetch(`/api/github/installations/${installationId}/repositories`, {
        credentials: "include"
      });
      if (res.ok) setRepos((await res.json()) as Repo[]);
    })();
  }, [installationId]);

  useEffect(() => {
    if (!repo || !installationId) {
      setBranches([]);
      setBranch("");
      return;
    }
    const [owner, ...rest] = repo.split("/");
    const r = rest.join("/");
    void (async () => {
      const res = await fetch(
        `/api/github/repos/${encodeURIComponent(owner!)}/${encodeURIComponent(r)}/branches?installationId=${encodeURIComponent(installationId)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const b = (await res.json()) as Branch[];
        setBranches(b);
        const meta = repos.find((x) => x.fullName === repo);
        setBranch(meta?.defaultBranch ?? b[0]?.name ?? "");
      }
    })();
  }, [repo, installationId, repos]);

  useEffect(() => {
    if (!repo || !branch || !installationId) {
      setStack(null);
      return;
    }
    void (async () => {
      const res = await fetch("/api/github/detect-stack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName: repo, branch, installationId })
      });
      if (res.ok) {
        const s = (await res.json()) as Stack;
        setStack(s);
        if (!override) {
          setFw(s.framework);
          setRt(s.runtime);
          setBuild(s.buildCommand);
          setStart(s.startCommand);
          setRestart(s.restartCommand);
        }
      }
    })();
  }, [repo, branch, installationId, override]);

  useEffect(() => {
    if (!stack?.pipeline || override) return;
    if (stack.pipeline.defaultWebServer && !webServer) {
      setWebServer(stack.pipeline.defaultWebServer);
    }
  }, [stack, override, webServer]);

  useEffect(() => {
    if (!serverId) return;
    void (async () => {
      const res = await fetch(`/api/servers/${serverId}/suggested-port`, { credentials: "include" });
      if (res.ok) {
        const j = (await res.json()) as { port: number };
        setPort((p) => (p === "" ? j.port : p));
      }
    })();
  }, [serverId]);

  const selectedServer = servers.find((s) => s.id === serverId);
  const defaultPath = useMemo(
    () => defaultProjectDeploymentPath(selectedServer?.deployRoot, slugify(name || "app")),
    [name, selectedServer?.deployRoot]
  );

  useEffect(() => {
    if (name && serverId && !deploymentPath) setDeploymentPath(defaultPath);
  }, [name, defaultPath, deploymentPath, serverId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await createProjectAction({
      name,
      serverId,
      repository: repo,
      branch,
      deploymentPath: deploymentPath || defaultPath,
      installationId: installationId || undefined,
      githubInstallationId: installationId || undefined,
      framework: fw || undefined,
      runtime: rt || undefined,
      domain: domain || undefined,
      webServer: webServer || undefined,
      buildCommand: build,
      startCommand: start,
      restartCommand: restart
    });
    setPending(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    router.push(`/dashboard/projects/${res.projectId}`);
    router.refresh();
  }

  return (
    <DashboardPage>
      <Link href="/dashboard/projects" className={cn(buttonVariants({ variant: "ghost" }))}>
        ← Back
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New project</CardTitle>
          <CardDescription>
            GitHub App installation → repository → branch. Stack is detected automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {servers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Add a server first.{" "}
              <Link href="/dashboard/servers/new" className="text-primary underline">
                Add server
              </Link>
            </p>
          ) : installations.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Install the GitHub App and complete a webhook installation.{" "}
              <Link href="/dashboard/settings" className="text-primary underline">
                Settings
              </Link>
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="flex gap-2 text-xs">
                {["GitHub", "Stack", "Infra", "Review"].map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1",
                      step === i ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                    onClick={() => setStep(i)}
                  >
                    {i + 1}. {t}
                  </button>
                ))}
              </div>

              {step === 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Installation</Label>
                    <select
                      required
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={installationId}
                      onChange={(e) => setInstallationId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {installations.map((i) => (
                        <option key={i.id} value={i.installationId}>
                          {i.accountLogin} ({i.installationId})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Repository</Label>
                    <select
                      required
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {repos.map((r) => (
                        <option key={r.fullName} value={r.fullName}>
                          {r.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <select
                      required
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" onClick={() => setStep(1)}>
                    Next
                  </Button>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-4">
                  {stack ? (
                    <div className="bg-muted rounded-md p-3 text-sm">
                      <p className="font-medium">Detected · {stack.pipeline.label}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <FrameworkBadge framework={stack.framework} />
                        <span className="text-muted-foreground font-mono text-xs">{stack.runtime}</span>
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">{stack.pipeline.description}</p>
                      <ul className="text-muted-foreground mt-2 list-inside list-disc text-xs">
                        {stack.hints.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                      {!override ? (
                        <p className="text-muted-foreground mt-2 font-mono text-xs">
                          Build: {stack.buildCommand || "—"}
                          <br />
                          Start: {stack.startCommand || "—"}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Select repo and branch first.</p>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                    Override commands / stack
                  </label>
                  {override ? (
                    <div className="grid gap-2">
                      <Input placeholder="framework" value={fw} onChange={(e) => setFw(e.target.value)} />
                      <Input placeholder="runtime" value={rt} onChange={(e) => setRt(e.target.value)} />
                      <Input placeholder="build" value={build} onChange={(e) => setBuild(e.target.value)} />
                      <Input placeholder="start" value={start} onChange={(e) => setStart(e.target.value)} />
                      <Input placeholder="restart" value={restart} onChange={(e) => setRestart(e.target.value)} />
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(0)}>
                      Back
                    </Button>
                    <Button type="button" onClick={() => setStep(2)}>
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Web server</Label>
                    <div className="flex flex-wrap gap-3">
                      {(["nginx", "apache"] as const).map((w) => (
                        <label key={w} className="flex items-center gap-2 text-sm capitalize">
                          <input
                            type="radio"
                            name="web"
                            checked={webServer === w}
                            onChange={() => setWebServer(w)}
                          />
                          {w}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain (optional)</Label>
                    <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="app.example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">App port</Label>
                    <p id="port" className="text-muted-foreground font-mono text-sm">
                      {stack?.pipeline.needsAppPort === false
                        ? "Not used (nginx + PHP-FPM or static files)"
                        : port === ""
                          ? "Auto-assigned on create"
                          : port}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {stack?.pipeline.needsAppPort === false
                        ? "This pipeline is served directly by the web server."
                        : "Assigned automatically to avoid conflicts on this server."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button type="button" onClick={() => setStep(3)}>
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project name</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Server</Label>
                    <select
                      required
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={serverId}
                      onChange={(e) => setServerId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {servers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.host})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deploymentPath">Deployment path</Label>
                    <Input
                      id="deploymentPath"
                      required
                      value={deploymentPath || defaultPath}
                      onChange={(e) => setDeploymentPath(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button type="submit" disabled={pending}>
                      {pending ? "Creating…" : "Create project"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </form>
          )}
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
