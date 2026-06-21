export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORG_ROLES = ["owner", "admin", "developer", "viewer"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Legacy values stored before four-role migration. */
export const LEGACY_ORG_ROLES = ["admin", "member"] as const;

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isOrgRole(value: string): value is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(value);
}

export function normalizeOrgRole(role: string): OrgRole {
  if (isOrgRole(role)) return role;
  if (role === "admin") return "admin";
  if (role === "member") return "developer";
  return "viewer";
}
