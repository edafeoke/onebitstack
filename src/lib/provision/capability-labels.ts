import type { ServerCapabilities } from "@/lib/provision/debian";

export const CAPABILITY_ROWS: { key: keyof ServerCapabilities; label: string; required?: boolean }[] =
  [
    { key: "git", label: "Git", required: true },
    { key: "nginx", label: "Nginx", required: true },
    { key: "node", label: "Node.js", required: true },
    { key: "pm2", label: "PM2", required: true },
    { key: "php", label: "PHP (CLI)", required: true },
    { key: "phpFpm", label: "PHP-FPM", required: true },
    { key: "phpSqlite", label: "PHP PDO SQLite", required: true },
    { key: "composer", label: "Composer", required: true },
    { key: "python", label: "Python 3" },
    { key: "apache", label: "Apache" },
    { key: "docker", label: "Docker" },
    { key: "bun", label: "Bun" }
  ];
