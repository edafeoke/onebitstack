import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DeploymentStatusBadge({
  status,
  className
}: {
  status: string;
  className?: string;
}) {
  const variant =
    status === "failed"
      ? "destructive"
      : status === "success"
        ? "default"
        : status === "running"
          ? "secondary"
          : status === "cancelled"
            ? "outline"
            : "secondary";

  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      {status}
    </Badge>
  );
}

export function DeploymentKindBadge({ kind }: { kind: string }) {
  const label =
    kind === "config_only"
      ? "config"
      : kind === "rollback"
        ? "rollback"
        : "full";
  return (
    <Badge variant="outline" className="font-mono text-xs capitalize">
      {label}
    </Badge>
  );
}
