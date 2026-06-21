import type { ProvisionFlags, ServerCapabilities } from "@/lib/provision/debian";

/** Packages to install for a typical Central Stack VPS (Node/Next + Laravel). */
export const REQUIRED_PROVISION_FLAGS: ProvisionFlags = {
  git: true,
  nginx: true,
  apache: false,
  node: true,
  pm2: true,
  docker: false,
  bun: false,
  php: true,
  python: false
};

/** Capability keys shown in the server UI (probe order). */
export const CAPABILITY_PROBE_KEYS = [
  "git",
  "nginx",
  "node",
  "pm2",
  "php",
  "phpFpm",
  "phpSqlite",
  "composer",
  "python",
  "apache",
  "docker",
  "bun"
] as const satisfies readonly (keyof ServerCapabilities)[];

export function isRequiredCapabilitySatisfied(caps: ServerCapabilities): boolean {
  return (
    Boolean(caps.git) &&
    Boolean(caps.nginx) &&
    Boolean(caps.node) &&
    Boolean(caps.pm2) &&
    Boolean(caps.php) &&
    Boolean(caps.phpFpm) &&
    Boolean(caps.phpSqlite) &&
    Boolean(caps.composer)
  );
}
