"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectPublicUrl } from "@/lib/project-public-url";

function formatDeployedAt(date: Date): string {
  const ms = date.getTime() - Date.now();
  const sec = Math.round(ms / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, "second");
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(hr, "hour");
  const day = Math.round(hr / 24);
  return rtf.format(day, "day");
}

function PreviewFrame({ href, label }: { href: string; label: string }) {
  const [embedFailed, setEmbedFailed] = useState(false);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border bg-muted">
        {embedFailed ? (
          <div className="flex h-[min(400px,50vh)] flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Inline preview is blocked by the site&apos;s security headers. The site still works
              when opened directly.
            </p>
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              Open {label}
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        ) : (
          <iframe
            title={`Preview of ${label}`}
            src={href}
            className="h-[min(400px,50vh)] w-full border-0 bg-background"
            referrerPolicy="no-referrer-when-downgrade"
            onError={() => setEmbedFailed(true)}
            onLoad={(e) => {
              const el = e.currentTarget;
              try {
                const doc = el.contentDocument;
                if (doc && doc.body?.childElementCount === 0) setEmbedFailed(true);
              } catch {
                // Cross-origin load succeeded; cannot inspect document.
              }
            }}
          />
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {embedFailed
          ? "Regenerate nginx config and redeploy (config only) after setting BETTER_AUTH_URL on Central so frame-ancestors includes this dashboard."
          : "If the preview is empty, use Open — some apps block embedding until nginx is updated."}
      </p>
    </div>
  );
}

export function ProjectLivePreview({
  publicUrl,
  deployedAt
}: {
  publicUrl: ProjectPublicUrl | null;
  deployedAt: Date;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Live site</CardTitle>
          <CardDescription>Last deployed {formatDeployedAt(deployedAt)}</CardDescription>
        </div>
        {publicUrl ? (
          <Link
            href={publicUrl.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            Open
            <ExternalLink className="size-3.5" />
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {publicUrl ? (
          <>
            <p className="text-sm">
              <Link
                href={publicUrl.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary underline-offset-4 hover:underline"
              >
                {publicUrl.href}
              </Link>
              {publicUrl.kind === "host" ? (
                <span className="text-muted-foreground ml-2 text-xs">(direct to app port)</span>
              ) : null}
            </p>
            <PreviewFrame href={publicUrl.href} label={publicUrl.label} />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Deployed successfully. Add a <strong>domain</strong> on the Deploy tab (Infrastructure
            → General) to get a public HTTPS link.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
