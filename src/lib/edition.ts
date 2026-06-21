export type CentralEdition = "website" | "control_plane";

/** Public marketing site vs installable control plane (VPS). */
export function getEdition(): CentralEdition {
  const v = process.env.CENTRAL_EDITION?.trim().toLowerCase();
  if (v === "website" || v === "marketing") return "website";
  if (v === "control_plane") return "control_plane";
  if (!process.env.DATABASE_URL?.trim()) return "website";
  return "control_plane";
}

export function isWebsiteEdition(): boolean {
  return getEdition() === "website";
}

export function isControlPlaneEdition(): boolean {
  return getEdition() === "control_plane";
}
