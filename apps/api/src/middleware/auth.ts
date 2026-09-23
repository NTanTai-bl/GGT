import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@pentest/shared";
import { User } from "@pentest/database";
import { env } from "../config/env";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const SESSION_COOKIE = "pentest_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

interface SessionPayload extends AuthenticatedUser {
  sessionVersion: number;
}

export function issueSessionCookie(res: Response, user: SessionPayload): void {
  const token = jwt.sign(user, env.SESSION_SECRET, { expiresIn: SESSION_TTL_SECONDS });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET) as SessionPayload;
    const user = await User.findByPk(payload.id);
    if (!user || !user.isActive || user.sessionVersion !== payload.sessionVersion) {
      clearSessionCookie(res);
      res.status(401).json({ error: "Session expired or invalid" });
      return;
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    clearSessionCookie(res);
    res.status(401).json({ error: "Session expired or invalid" });
  }
}
