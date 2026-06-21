import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();
  return children;
}
