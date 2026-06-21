"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  queueConfigOnlyDeployAction,
  regenerateProjectConfigsAction,
  updateProjectInfraAction
} from "@/app/dashboard/projects/project-infra-actions";
import { EnvVarsTable } from "@/components/env-vars-table";
import { FrameworkBadge } from "@/components/framework-badge";
import { ProjectBranchSelector } from "@/components/project-branch-selector";
import type { EnvVarClientRow } from "@/lib/project-env";
import { isPhpFpmStack } from "@/lib/deployment/templates/nginx";
import { isStaticStack } from "@/lib/deployment/templates/nginx-common";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.Editor), { ssr: false });

const editorOptions = {
  lineNumbers: "on" as const,
  minimap: { enabled: false },
  wordWrap: "on" as const,
  scrollBeyondLastLine: false,
  automaticLayout: true
};

type P = {
  id: string;
  name: string;
  repository: string;
  branch: string;
  deploymentPath: string;
  framework: string | null;
  runtime: string | null;
  domain: string | null;
  webServer: string | null;
  port: number | null;
  buildCommand: string;
  startCommand: string;
  restartCommand: string;
  nginxConfig: string | null;
  apacheConfig: string | null;
  pm2Config: string | null;
  envVars: EnvVarClientRow[];
  githubInstallationId: string | null;
  productionEnvironmentId: string;
  productionBranch: string;
  serverId: string;
};

const tabs = ["general", "deploy", "env", "nginx", "apache", "pm2", "logs"] as const;

export function ProjectInfraPanel({ project }: { project: P }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]>("general");
  const [fw, setFw] = useState(project.framework ?? "");
  const [rt, setRt] = useState(project.runtime ?? "");
  const [dom, setDom] = useState(project.domain ?? "");
  const [ws, setWs] = useState(project.webServer ?? "");
  const [port, setPort] = useState(project.port?.toString() ?? "");
  const [build, setBuild] = useState(project.buildCommand);
  const [start, setStart] = useState(project.startCommand);
  const [restart, setRestart] = useState(project.restartCommand);
  const [nginx, setNginx] = useState(project.nginxConfig ?? "");
  const [apache, setApache] = useState(project.apacheConfig ?? "");
  const [pm2, setPm2] = useState(project.pm2Config ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const configDirtyRef = useRef(false);

  const configSyncKey = useMemo(
    () =>
      JSON.stringify({
        nginx: project.nginxConfig,
        apache: project.apacheConfig,
        pm2: project.pm2Config,
        fw: project.framework,
        rt: project.runtime,
        dom: project.domain,
        ws: project.webServer,
        port: project.port,
        build: project.buildCommand,
        start: project.startCommand,
        restart: project.restartCommand
      }),
    [project]
  );

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (hash && tabs.includes(hash as (typeof tabs)[number])) {
      setTab(hash as (typeof tabs)[number]);
    }
  }, []);

  useEffect(() => {
    if (configDirtyRef.current) return;
    setFw(project.framework ?? "");
    setRt(project.runtime ?? "");
    setDom(project.domain ?? "");
    setWs(project.webServer ?? "");
    setPort(project.port?.toString() ?? "");
    setBuild(project.buildCommand);
    setStart(project.startCommand);
    setRestart(project.restartCommand);
    setNginx(project.nginxConfig ?? "");
    setApache(project.apacheConfig ?? "");
    setPm2(project.pm2Config ?? "");
  }, [project.id, configSyncKey]);

  async function save() {
    setPending(true);
    setMsg(null);
    const res = await updateProjectInfraAction({
      projectId: project.id,
      framework: fw || undefined,
      runtime: rt || undefined,
      domain: dom || undefined,
      webServer: ws === "nginx" || ws === "apache" ? ws : null,
      buildCommand: build,
      startCommand: start,
      restartCommand: restart,
      nginxConfig: nginx || null,
      apacheConfig: apache || null,
      pm2Config: pm2 || null
    });
    setPending(false);
    setMsg(res.ok ? "Saved." : res.message);
    if (res.ok) {
      configDirtyRef.current = false;
      router.refresh();
    }
  }

  async function regenerate() {
    setPending(true);
    setMsg(null);
    const res = await regenerateProjectConfigsAction({
      projectId: project.id,
      port: project.port,
      webServer: ws === "nginx" || ws === "apache" ? ws : null,
      domain: dom,
      runtime: rt || undefined,
      framework: fw || undefined
    });
    setPending(false);
    if (!res.ok) {
      setMsg(res.message);
      return;
    }
    if (res.nginxConfig != null) setNginx(res.nginxConfig);
    if (res.apacheConfig != null) setApache(res.apacheConfig);
    if (res.pm2Config != null) setPm2(res.pm2Config);
    configDirtyRef.current = false;
    setMsg(
      [
        res.nginxConfig ? "nginx" : null,
        res.apacheConfig ? "apache" : null,
        res.pm2Config ? "pm2" : null
      ]
        .filter(Boolean)
        .join(", ") + " config regenerated — open the matching tab to review."
    );
    router.refresh();
  }

  async function redeployCfg() {
    setPending(true);
    const res = await queueConfigOnlyDeployAction({ projectId: project.id });
    setPending(false);
    if (!res.ok) setMsg(res.message);
    else router.push(`/dashboard/deployments/${res.deploymentId}`);
  }

  function markConfigDirty() {
    configDirtyRef.current = true;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded-md px-3 py-1 text-sm capitalize ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "general" ? (
        <div className="grid gap-4 text-sm">
          <p>
            <span className="text-muted-foreground">Repository: </span>
            <span className="font-mono">{project.repository}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Detected stack:</span>
            <FrameworkBadge framework={project.framework} />
            {project.runtime ? (
              <span className="text-muted-foreground font-mono text-xs">{project.runtime}</span>
            ) : null}
          </div>
          <ProjectBranchSelector
            projectId={project.id}
            environmentId={project.productionEnvironmentId}
            repository={project.repository}
            installationId={project.githubInstallationId}
            currentBranch={project.productionBranch}
          />
        </div>
      ) : null}
      {tab === "env" ? (
        <EnvVarsTable projectId={project.id} initialRows={project.envVars} />
      ) : null}
      {tab === "deploy" ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Framework</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={fw}
                onChange={(e) => {
                  markConfigDirty();
                  setFw(e.target.value);
                }}
                className="max-w-xs"
              />
              <FrameworkBadge framework={fw} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Runtime</Label>
            <Input value={rt} onChange={(e) => setRt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Domain</Label>
            <Input value={dom} onChange={(e) => setDom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Web server</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={ws}
              onChange={(e) => setWs(e.target.value)}
            >
              <option value="">—</option>
              <option value="nginx">nginx</option>
              <option value="apache">apache</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Port</Label>
            <p className="text-muted-foreground font-mono text-sm">
              {project.port != null
                ? project.port
                : isPhpFpmStack(fw || project.framework, rt || project.runtime)
                  ? "Not used (nginx + PHP-FPM)"
                  : isStaticStack(fw || project.framework, rt || project.runtime)
                    ? "Not used (static via nginx)"
                    : "Auto-assigned on save"}
            </p>
            <p className="text-muted-foreground text-xs">
              {isPhpFpmStack(fw || project.framework, rt || project.runtime) ||
              isStaticStack(fw || project.framework, rt || project.runtime)
                ? "Laravel and static sites are served directly by nginx."
                : "Assigned automatically to avoid conflicts on this server."}
            </p>
          </div>
          <div className="space-y-1">
            <Label>Build</Label>
            <Input value={build} onChange={(e) => setBuild(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Start</Label>
            <Input value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Restart</Label>
            <Input value={restart} onChange={(e) => setRestart(e.target.value)} />
          </div>
        </div>
      ) : null}
      {tab === "nginx" ? (
        <div className="h-[280px] overflow-hidden rounded-md border">
          <Editor
            height="280px"
            language="nginx"
            theme="vs-dark"
            value={nginx}
            options={editorOptions}
            onChange={(v) => {
              markConfigDirty();
              setNginx(v ?? "");
            }}
          />
        </div>
      ) : null}
      {tab === "apache" ? (
        <div className="h-[280px] overflow-hidden rounded-md border">
          <Editor
            height="280px"
            language="plaintext"
            theme="vs-dark"
            value={apache}
            options={editorOptions}
            onChange={(v) => {
              markConfigDirty();
              setApache(v ?? "");
            }}
          />
        </div>
      ) : null}
      {tab === "pm2" ? (
        <div className="h-[280px] overflow-hidden rounded-md border">
          <Editor
            height="280px"
            language="javascript"
            theme="vs-dark"
            value={pm2}
            options={editorOptions}
            onChange={(v) => {
              markConfigDirty();
              setPm2(v ?? "");
            }}
          />
        </div>
      ) : null}
      {tab === "logs" ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Tail nginx, PM2, and app logs on the server, or open deployment logs from the deployments page.
          </p>
          <a
            href={`/dashboard/servers/${project.serverId}/logs?projectId=${encodeURIComponent(project.id)}&source=app`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Open server logs →
          </a>
        </div>
      ) : null}
      {tab === "env" ? null : tab !== "general" && tab !== "logs" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => void save()}>
            Save
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => void regenerate()}>
            Regenerate configs
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => void redeployCfg()}>
            Redeploy config only
          </Button>
        </div>
      ) : null}
      {msg ? <p className="text-muted-foreground text-sm">{msg}</p> : null}
    </div>
  );
}
