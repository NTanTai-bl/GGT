import type { NextFunction, Request, Response } from "express";
import { can, type Permission } from "@pentest/shared";
import { ProjectMember } from "@pentest/database";
import { HttpError } from "./errorHandler";

/** Requires the caller's role to have `permission` (spec §25). Must run after requireAuth. */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!can(req.user.role, permission)) {
      res.status(403).json({ error: `Role ${req.user.role} cannot perform this action` });
      return;
    }
    next();
  };
}

/**
 * "User belongs to project" (spec §11 rule #2). ADMIN and SECURITY act
 * globally per §25's wording ("manage everything" / no per-project
 * qualifier); DEVELOPER and VIEWER are scoped to projects they're a member
 * of (§25: "view ASSIGNED projects"). Throws HttpError rather than writing
 * the response directly, so callers can await it inside a service function
 * alongside other DB-dependent checks.
 */
export async function assertProjectAccess(
  projectId: string,
  user: { id: string; role: string },
  hideExistence = false
): Promise<void> {
  if (user.role === "ADMIN" || user.role === "SECURITY") return;

  const membership = await ProjectMember.findOne({ where: { projectId, userId: user.id } });
  if (!membership) {
    throw new HttpError(hideExistence ? 404 : 403, hideExistence ? "Resource not found" : "You are not a member of this project");
  }
}
