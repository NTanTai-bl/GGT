import type { NextFunction, Request, Response } from "express";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * `router.param("id", uuidParam)` — every `:id` in this API is a UUID primary
 * key. Without this guard a malformed id reaches Postgres and fails with
 * "invalid input syntax for type uuid", which surfaces as a 500. A malformed
 * id can never match a row, so answer 404 like any other unknown resource.
 */
export function uuidParam(_req: Request, res: Response, next: NextFunction, value: string): void {
  if (!isUuid(value)) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }
  next();
}
