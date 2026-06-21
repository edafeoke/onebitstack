"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPage } from "@/components/dashboard-page";
import { ServerForm } from "@/components/forms/server-form";

export default function NewServerPage() {
  const router = useRouter();

  return (
    <DashboardPage>
      <Link href="/dashboard/servers" className={cn(buttonVariants({ variant: "ghost" }))}>
        ← Back
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Add server</CardTitle>
          <CardDescription>Paste an OpenSSH private key in PEM format.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerForm
            mode="create"
            onSuccess={() => {
              router.push("/dashboard/servers");
              router.refresh();
            }}
          />
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
