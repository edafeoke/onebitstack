import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HealthAlert } from "@/lib/health/alerts";

const severityStyles: Record<HealthAlert["severity"], string> = {
  info: "border-border bg-muted/40",
  warning: "border-amber-500/40 bg-amber-500/10",
  error: "border-destructive/40 bg-destructive/10"
};

export function DashboardHealthAlerts({ alerts }: { alerts: HealthAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li
          key={a.id}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            severityStyles[a.severity]
          )}
        >
          <p className="font-medium">{a.title}</p>
          <p className="text-muted-foreground text-xs">{a.detail}</p>
          {a.href ? (
            <Link href={a.href} className="text-primary mt-1 inline-block text-xs underline-offset-2 hover:underline">
              View →
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
