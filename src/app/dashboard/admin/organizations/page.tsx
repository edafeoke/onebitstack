import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { DashboardPage } from "@/components/dashboard-page";

export default async function AdminOrganizationsPage() {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      kind: true,
      createdAt: true,
      _count: { select: { members: true, servers: true, projects: true } }
    }
  });

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground text-sm">All workspaces on the platform.</p>
        </div>
        <Link
          href="/dashboard/admin"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          ← Admin
        </Link>
      </div>
      <div className="border-border overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Servers</TableHead>
              <TableHead>Projects</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell className="font-mono text-xs">{o.slug}</TableCell>
                <TableCell>{o.kind}</TableCell>
                <TableCell>{o._count.members}</TableCell>
                <TableCell>{o._count.servers}</TableCell>
                <TableCell>{o._count.projects}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardPage>
  );
}
