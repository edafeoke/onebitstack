import {
  LEGACY_VPS_PATHS,
  projectAppRoot,
  protectedTeardownPaths,
  serverLayoutFromRoot
} from "@/lib/server-layout";

export type TeardownPathValidation =
  | { ok: true; appRoot: string; skipAppDirectoryRemoval: boolean }
  | { ok: false; reason: string };

function isStrictChildOf(parent: string, child: string): boolean {
  const p = parent.replace(/\/+$/, "");
  const c = child.replace(/\/+$/, "");
  return c.startsWith(`${p}/`) && c.length > p.length + 1;
}

/**
 * Validates which directory may be removed during project delete.
 * Uses the project's stored deployment path (not the name slug) for the app tree.
 * Blocks shallow or shared roots from full-tree deletion.
 */
export function validateTeardownAppRoot(
  deploymentPath: string,
  _slug: string,
  deployRoot?: string | null
): TeardownPathValidation {
  const appRoot = projectAppRoot(deploymentPath, deployRoot);
  const normalized = appRoot.replace(/\/+$/, "");
  const layout = serverLayoutFromRoot(deployRoot);

  if (!normalized) {
    return { ok: false, reason: "Deployment path is empty." };
  }

  if (normalized === LEGACY_VPS_PATHS.sharedApp) {
    return {
      ok: true,
      appRoot: normalized,
      skipAppDirectoryRemoval: true
    };
  }

  const legacyUnderSharedApp =
    normalized.startsWith(`${LEGACY_VPS_PATHS.sharedApp}/`) &&
    !normalized.startsWith(`${LEGACY_VPS_PATHS.apps}/`);

  if (legacyUnderSharedApp) {
    if (!isStrictChildOf(LEGACY_VPS_PATHS.sharedApp, normalized)) {
      return {
        ok: false,
        reason: `Legacy deployment path "${normalized}" must be a project subdirectory under ${LEGACY_VPS_PATHS.sharedApp}/.`
      };
    }
    return { ok: true, appRoot: normalized, skipAppDirectoryRemoval: false };
  }

  if ((protectedTeardownPaths(deployRoot) as readonly string[]).includes(normalized)) {
    return {
      ok: false,
      reason: `Refusing to delete protected directory "${normalized}". Set a per-project path such as ${layout.apps}/<name>.`
    };
  }

  if (normalized === layout.apps || normalized === LEGACY_VPS_PATHS.apps) {
    return {
      ok: false,
      reason: `Refusing to delete the shared apps directory "${normalized}".`
    };
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 3) {
    return {
      ok: false,
      reason: `Deployment path "${normalized}" is too shallow for automated directory removal.`
    };
  }

  if (
    isStrictChildOf(layout.apps, normalized) ||
    isStrictChildOf(LEGACY_VPS_PATHS.apps, normalized)
  ) {
    return { ok: true, appRoot: normalized, skipAppDirectoryRemoval: false };
  }

  return { ok: true, appRoot: normalized, skipAppDirectoryRemoval: false };
}
