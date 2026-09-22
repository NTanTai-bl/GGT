import bcrypt from "bcryptjs";
import { recordAuditLog, User } from "@pentest/database";
import { HttpError } from "../middleware/errorHandler";

export async function authenticate(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.scope("withPassword").findOne({ where: { email: normalizedEmail } });
  if (!user) {
    await recordAuditLog({ action: "LOGIN_FAILED", entityType: "user", metadata: { email: normalizedEmail } });
    throw new HttpError(401, "Invalid email or password");
  }
  if (!user.isActive) {
    await recordAuditLog({
      actorId: user.id,
      action: "LOGIN_BLOCKED",
      entityType: "user",
      entityId: user.id,
      metadata: { reason: "ACCOUNT_DISABLED" },
    });
    throw new HttpError(401, "Invalid email or password");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await recordAuditLog({
      actorId: user.id,
      action: "LOGIN_FAILED",
      entityType: "user",
      entityId: user.id,
    });
    throw new HttpError(401, "Invalid email or password");
  }
  return user;
}
