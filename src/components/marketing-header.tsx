import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPublicAppName } from "@/lib/app-config";
import { isControlPlaneEdition, isWebsiteEdition } from "@/lib/edition";

export function MarketingHeader() {
  const appName = getPublicAppName();
  const website = isWebsiteEdition();
  const controlPlane = isControlPlaneEdition();

  return (
    <header className="border-border/60 sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          {appName}
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/docs"
            className="text-muted-foreground hover:text-foreground hidden px-2 sm:inline"
          >
            Docs
          </Link>
          {website ? (
            <Button size="sm" render={<Link href="/install" />}>
              Install
            </Button>
          ) : controlPlane ? (
            <>
              <Button size="sm" variant="ghost" render={<Link href="/login" />}>
                Sign in
              </Button>
              <Button size="sm" variant="outline" render={<Link href="/dashboard" />}>
                Dashboard
              </Button>
              <Button size="sm" render={<Link href="/setup" />}>
                Setup
              </Button>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
