"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            An error occurred while loading this page. You can retry or return to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground font-mono text-xs break-all">{error.message}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => reset()}>
              Try again
            </Button>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
