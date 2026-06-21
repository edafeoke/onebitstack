import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { getAppName } from "@/lib/app-config";
import { isWebsiteEdition } from "@/lib/edition";

export function baseOptions(): BaseLayoutProps {
  const name = getAppName();
  const website = isWebsiteEdition();
  return {
    nav: {
      title: name,
      url: "/"
    },
    links: website
      ? [
          { text: "Install", url: "/install", active: "none" },
          { text: "Docs home", url: "/docs", active: "none" }
        ]
      : [
          { text: "Dashboard", url: "/dashboard", active: "none" },
          { text: "Sign in", url: "/login", active: "none" }
        ]
  };
}
