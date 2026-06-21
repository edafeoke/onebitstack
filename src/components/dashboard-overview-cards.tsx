import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export function DashboardOverviewCards({
  projectCount,
  serverCount,
  runningCount,
  failedRecent
}: {
  projectCount: number;
  serverCount: number;
  runningCount: number;
  failedRecent: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Projects</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {projectCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Git</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm">
          <Link href="/dashboard/projects" className="text-primary font-medium hover:underline">
            Manage projects
          </Link>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Servers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {serverCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">VPS</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm">
          <Link href="/dashboard/servers" className="text-primary font-medium hover:underline">
            View infrastructure
          </Link>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active deployments</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {runningCount}
          </CardTitle>
          <CardAction>
            <Badge variant="secondary">Live</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-muted-foreground text-sm">Queued or running</CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Failed (24h)</CardDescription>
          <CardTitle
            className={`text-2xl font-semibold tabular-nums @[250px]/card:text-3xl ${failedRecent > 0 ? "text-destructive" : ""}`}
          >
            {failedRecent}
          </CardTitle>
          <CardAction>
            <Badge variant={failedRecent > 0 ? "destructive" : "outline"}>
              {failedRecent > 0 ? "Attention" : "OK"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm">
          <Link
            href="/dashboard/deployments"
            className="text-primary font-medium hover:underline"
          >
            View deployment logs
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
