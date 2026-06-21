import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDeploymentDuration } from "@/lib/deployment-format";
import { DeploymentKindBadge, DeploymentStatusBadge } from "@/components/deployment-status-badge";
import { buttonVariants } from "@/components/ui/button";

export type TimelineDeployment = {
  id: string;
  status: string;
  kind: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  commitHash: string | null;
};

type StepState = "done" | "current" | "pending" | "failed";

function stepState(
  deployment: TimelineDeployment,
  step: "queued" | "running" | "finished"
): StepState {
  const { status } = deployment;
  if (status === "failed" || status === "cancelled") {
    if (step === "queued") return "done";
    if (step === "running") return status === "cancelled" ? "failed" : "failed";
    return "failed";
  }
  if (status === "queued") {
    if (step === "queued") return "current";
    return "pending";
  }
  if (status === "running") {
    if (step === "queued") return "done";
    if (step === "running") return "current";
    return "pending";
  }
  if (status === "success") {
    return "done";
  }
  return "pending";
}

function StepDot({ state }: { state: StepState }) {
  return (
    <span
      className={cn(
        "mt-1.5 size-2.5 shrink-0 rounded-full border-2",
        state === "done" && "border-primary bg-primary",
        state === "current" && "border-primary bg-background animate-pulse",
        state === "pending" && "border-muted-foreground/40 bg-background",
        state === "failed" && "border-destructive bg-destructive"
      )}
    />
  );
}

function DeploymentTimelineItem({ d }: { d: TimelineDeployment }) {
  const steps = [
    { key: "queued" as const, label: "Queued", at: d.createdAt },
    { key: "running" as const, label: "Running", at: d.startedAt },
    {
      key: "finished" as const,
      label: d.status === "success" ? "Succeeded" : d.status === "failed" ? "Failed" : "Finished",
      at: d.finishedAt
    }
  ];

  return (
    <li className="border-b pb-4 last:border-0 last:pb-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DeploymentKindBadge kind={d.kind} />
          <DeploymentStatusBadge status={d.status} />
          {d.commitHash ? (
            <span className="text-muted-foreground font-mono text-xs">{d.commitHash.slice(0, 7)}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {formatDeploymentDuration(d.startedAt, d.finishedAt)}
          </span>
          <Link
            href={`/dashboard/deployments/${d.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Logs
          </Link>
        </div>
      </div>
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((step) => {
          const state = stepState(d, step.key);
          return (
            <li key={step.key} className="flex gap-2 text-xs">
              <StepDot state={state} />
              <div>
                <p className="font-medium">{step.label}</p>
                <p className="text-muted-foreground font-mono">
                  {step.at ? step.at.toLocaleString() : "—"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </li>
  );
}

export function DeploymentTimeline({ deployments }: { deployments: TimelineDeployment[] }) {
  if (deployments.length === 0) {
    return <p className="text-muted-foreground text-sm">No deployments yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {deployments.map((d) => (
        <DeploymentTimelineItem key={d.id} d={d} />
      ))}
    </ol>
  );
}
