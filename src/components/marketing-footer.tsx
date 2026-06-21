import Link from "next/link";
import { getPublicAppName } from "@/lib/app-config";

export function MarketingFooter() {
  const year = new Date().getFullYear();
  const appName = getPublicAppName();

  return (
    <footer className="border-border/60 mt-auto border-t py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {appName}
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/docs" className="hover:text-foreground">
            Documentation
          </Link>
          <Link href="/docs/get-started/installation" className="hover:text-foreground">
            Installation
          </Link>
          <Link href="/docs/operations/vps" className="hover:text-foreground">
            Operations
          </Link>
        </nav>
      </div>
    </footer>
  );
}
