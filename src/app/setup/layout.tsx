import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { getPublicAppName } from "@/lib/app-config";

export default function SetupLayout({ children }: { children: ReactNode }) {
  const appName = getPublicAppName();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border/60 border-b px-4 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          {appName} setup
        </Link>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">{children}</main>
      <MarketingFooter />
    </div>
  );
}
