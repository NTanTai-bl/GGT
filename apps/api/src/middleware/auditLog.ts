import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

/** Structured JSON audit trail for every mutating request. */
export function auditLog(req: Request, res: Response, next: NextFunction): void {
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (!isMutation) {
    next();
    return;
  }

  res.on("finish", () => {
    logger.info(
      {
        event: "audit",
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        userId: req.user?.id ?? null,
      },
      "audit log entry"
    );
  });
  next();
}
