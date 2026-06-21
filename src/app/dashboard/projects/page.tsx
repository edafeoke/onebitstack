"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPage } from "@/components/dashboard-page";
import { DeleteProjectButton } from "@/components/delete-project-button";

type ProjectRow = {
  id: string;
  name: string;
  repository: string;
  branch: string;
  deploymentPath: string;
  server: { name: string; host: string };
  deployments: { id: string; status: string; createdAt: string; commitHash: string | null }[];
};

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as ProjectRow[];
    }
  });

  const deploy = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch("/api/deploy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { deploymentId: string };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["projects"] })
  });

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Connect GitHub repos to your VPS servers and deploy.
        </p>
        <Link
          href="/dashboard/projects/new"
          className={cn(buttonVariants())}
        >
          New project
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All projects</CardTitle>
          <CardDescription>Repository, branch, and last deployment status</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{(error as Error).message}</p>
          ) : !data?.length ? (
            <p className="text-muted-foreground text-sm">
              No projects yet.{" "}
              <Link href="/dashboard/projects/new" className="text-primary underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Last deploy</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => {
                  const last = p.deployments[0];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.repository}</TableCell>
                      <TableCell>{p.branch}</TableCell>
                      <TableCell>
                        {p.server.name}
                        <span className="text-muted-foreground block text-xs">{p.server.host}</span>
                      </TableCell>
                      <TableCell>
                        {last ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary">{last.status}</Badge>
                            <Link
                              href={`/dashboard/deployments/${last.id}`}
                              className="text-primary text-xs underline-offset-4 hover:underline"
                            >
                              View logs
                            </Link>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/dashboard/projects/${p.id}`}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                          >
                            Details
                          </Link>
                          <Button
                            size="sm"
                            disabled={deploy.isPending}
                            onClick={() => void deploy.mutateAsync(p.id)}
                          >
                            Deploy
                          </Button>
                          <DeleteProjectButton projectId={p.id} projectName={p.name} variant="table" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {deploy.isError ? (
        <p className="text-destructive text-sm">{(deploy.error as Error).message}</p>
      ) : null}
    </DashboardPage>
  );
}
