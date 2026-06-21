import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { cn } from "@/lib/utils";
import { getAppName } from "@/lib/app-config";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export function generateMetadata(): Metadata {
  const name = getAppName();
  return {
    title: name,
    description: `${name} — deployment control`
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
