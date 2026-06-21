import Link from "next/link";
import {
  collectProductionMisconfigs,
  isProductionRuntime,
  isRedisQueueEnabled
} from "@/lib/production/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export function DashboardProductionWarnings() {
  if (!isProductionRuntime()) return null;
  const issues = collectProductionMisconfigs();
  if (issues.length === 0) return null;

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle>Production configuration</CardTitle>
        <CardDescription>Recommended before running Central in production</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <ul className="text-muted-foreground list-inside list-disc space-y-1">
          {issues.map((issue) => (
            <li key={issue.code}>{issue.message}</li>
          ))}
        </ul>
        {!isRedisQueueEnabled() ? (
          <p>
            See <Link href="/dashboard/settings" className="text-primary underline">settings</Link>{" "}
            and run <code className="text-foreground">npm run worker:deploy</code> after starting Redis.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
