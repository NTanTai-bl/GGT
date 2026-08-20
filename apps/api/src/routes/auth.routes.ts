import { Router } from "express";
import { loginSchema } from "@pentest/shared";
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
    issueSessionCookie(res, { id: user.id, email: user.email });
    res.json({ id: user.id, email: user.email, displayName: user.displayName });
  })
);

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ id: req.user!.id, email: req.user!.email });
});
