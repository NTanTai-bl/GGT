import type { UserRole } from "./types";

/**
 * Permission matrix per spec §25. ADMIN is a superuser and short-circuits
 * every check in `can()` below rather than being listed per-permission.
 *
 * Two calls are NOT explicit in the spec and are an interpretation, flagged
 * here rather than buried: the spec only assigns SECURITY "create pentest /
 * cancel pentest / review findings / update finding status" but starting a
 * pentest requires targets and projects to already exist. We grant SECURITY
 * project/target management too, since otherwise the role couldn't operate
 * end-to-end. Revisit if that's not the intent.
 */
export type Permission =
  | "PROJECT_MANAGE" // create/edit projects, manage membership
  | "TARGET_MANAGE" // create/edit/delete targets
  | "PENTEST_CREATE"
  | "PENTEST_CANCEL"
  | "FINDING_UPDATE_ANY_STATUS"
  | "FINDING_MARK_FIXED_PENDING_RETEST";

const ROLE_PERMISSIONS: Record<Exclude<UserRole, "ADMIN">, Permission[]> = {
  SECURITY: [
    "PROJECT_MANAGE",
    "TARGET_MANAGE",
    "PENTEST_CREATE",
    "PENTEST_CANCEL",
    "FINDING_UPDATE_ANY_STATUS",
  ],
  DEVELOPER: ["FINDING_MARK_FIXED_PENDING_RETEST"],
  VIEWER: [],
};

export function can(role: UserRole, permission: Permission): boolean {
  if (role === "ADMIN") return true;
  return ROLE_PERMISSIONS[role].includes(permission);
}
