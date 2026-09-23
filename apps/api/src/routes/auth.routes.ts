import { Router } from "express";
import { loginSchema } from "@pentest/shared";
import { recordAuditLog } from "@pentest/database";
import { asyncHandler } from "./asyncHandler";
import { authenticate } from "../services/auth.service";
import { clearSessionCookie, issueSessionCookie, requireAuth } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rateLimit";

export const authRouter = Router();

authRouter.post(
  "/login",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await authenticate(input.email, input.password);
    issueSessionCookie(res, {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    });
    await recordAuditLog({ actorId: user.id, action: "LOGIN", entityType: "user", entityId: user.id });
    res.json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role });
  })
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await recordAuditLog({
      actorId: req.user!.id,
      action: "LOGOUT",
      entityType: "user",
      entityId: req.user!.id,
    });
    clearSessionCookie(res);
    res.status(204).send();
  })
);

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ id: req.user!.id, email: req.user!.email, role: req.user!.role });
});
