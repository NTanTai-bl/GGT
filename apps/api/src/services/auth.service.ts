import bcrypt from "bcryptjs";
import { User } from "@pentest/database";
import { HttpError } from "../middleware/errorHandler";

export async function authenticate(email: string, password: string): Promise<User> {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "Invalid email or password");
  }
  return user;
}
