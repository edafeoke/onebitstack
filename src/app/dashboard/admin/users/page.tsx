import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isUserRole } from "@/lib/auth/roles";
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
import { AdminUserRoleSelect } from "@/components/admin-user-role-select";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { organizationMembers: true } }
    }
  });

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">Platform accounts and roles.</p>
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
              <TableHead>Email</TableHead>
              <TableHead>Workspaces</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const role = isUserRole(u.role) ? u.role : "user";
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{u._count.organizationMembers}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {u.createdAt.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <AdminUserRoleSelect userId={u.id} currentRole={role} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </DashboardPage>
  );
}
