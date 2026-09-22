import bcrypt from "bcryptjs";
import { Op, UniqueConstraintError } from "sequelize";
import { AuditLog, Project, ProjectMember, recordAuditLog, User } from "@pentest/database";
import type {
  AssignUserProjectsInput,
  CreateUserInput,
  ResetUserPasswordInput,
  UpdateUserInput,
} from "@pentest/shared";
import { HttpError } from "../middleware/errorHandler";

const SAFE_USER_INCLUDE = [
  {
    model: ProjectMember,
    as: "memberships",
    include: [{ model: Project, as: "project", attributes: ["id", "name"] }],
  },
];

export async function listUsers(): Promise<User[]> {
  return User.findAll({ include: SAFE_USER_INCLUDE, order: [["createdAt", "DESC"]] });
}

export async function getUserOrThrow(userId: string): Promise<User> {
  const user = await User.findByPk(userId, { include: SAFE_USER_INCLUDE });
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function createUser(input: CreateUserInput, actorId: string): Promise<User> {
  try {
    const user = await User.create({
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, 12),
      isActive: true,
      sessionVersion: 0,
    });
    await recordAuditLog({
      actorId,
      action: "USER_CREATED",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    return getUserOrThrow(user.id);
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new HttpError(409, "A user with this email already exists");
    throw error;
  }
}

export async function updateUser(userId: string, input: UpdateUserInput, actorId: string): Promise<User> {
  const sequelize = User.sequelize;
  if (!sequelize) throw new Error("User model is not initialized");

  const before = await sequelize.transaction(async (transaction) => {
    // Lock active admins in a stable order before locking the target user. This
    // serializes concurrent demote/disable requests and avoids two admins both
    // passing a non-atomic "count > 1" check.
    const activeAdmins = await User.findAll({
      where: { role: "ADMIN", isActive: true },
      order: [["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new HttpError(404, "User not found");

    const removesActiveAdmin =
      user.role === "ADMIN" &&
      user.isActive &&
      ((input.role !== undefined && input.role !== "ADMIN") || input.isActive === false);

    if (removesActiveAdmin) {
      if (activeAdmins.length <= 1) {
        throw new HttpError(409, "The last active administrator cannot be disabled or demoted");
      }
    }

    const snapshot = { role: user.role, isActive: user.isActive, displayName: user.displayName };
    await user.update(
      {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      { transaction }
    );
    return snapshot;
  });

  const updated = await getUserOrThrow(userId);
  await recordAuditLog({
    actorId,
    action: "USER_UPDATED",
    entityType: "user",
    entityId: userId,
    metadata: {
      changes: {
        ...(input.displayName !== undefined ? { displayName: { from: before.displayName, to: input.displayName } } : {}),
        ...(input.role !== undefined ? { role: { from: before.role, to: input.role } } : {}),
        ...(input.isActive !== undefined ? { isActive: { from: before.isActive, to: input.isActive } } : {}),
      },
    },
  });
  return updated;
}

export async function resetUserPassword(
  userId: string,
  input: ResetUserPasswordInput,
  actorId: string
): Promise<void> {
  const user = await User.findByPk(userId);
  if (!user) throw new HttpError(404, "User not found");

  await user.update({
    passwordHash: await bcrypt.hash(input.password, 12),
    sessionVersion: user.sessionVersion + 1,
  });
  await recordAuditLog({
    actorId,
    action: "USER_PASSWORD_RESET",
    entityType: "user",
    entityId: userId,
  });
}

export async function assignUserProjects(
  userId: string,
  input: AssignUserProjectsInput,
  actorId: string
): Promise<User> {
  await getUserOrThrow(userId);
  const uniqueProjectIds = [...new Set(input.projectIds)];
  const projects = await Project.findAll({ where: { id: uniqueProjectIds } });
  if (projects.length !== uniqueProjectIds.length) throw new HttpError(404, "One or more projects do not exist");

  const sequelize = ProjectMember.sequelize;
  if (!sequelize) throw new Error("ProjectMember model is not initialized");
  await sequelize.transaction(async (transaction) => {
    const existing = await ProjectMember.findAll({ where: { userId }, transaction, lock: transaction.LOCK.UPDATE });
    const requested = new Set(uniqueProjectIds);
    const existingIds = new Set(existing.map((membership) => membership.projectId));
    await Promise.all([
      ...existing.filter((membership) => !requested.has(membership.projectId)).map((membership) => membership.destroy({ transaction })),
      ...uniqueProjectIds
        .filter((projectId) => !existingIds.has(projectId))
        .map((projectId) => ProjectMember.create({ projectId, userId, addedBy: actorId }, { transaction })),
    ]);
  });

  await recordAuditLog({
    actorId,
    action: "USER_PROJECTS_ASSIGNED",
    entityType: "user",
    entityId: userId,
    metadata: { projectIds: uniqueProjectIds },
  });
  return getUserOrThrow(userId);
}

export async function listUserAuditLogs(userId: string, limit: number, offset: number): Promise<AuditLog[]> {
  await getUserOrThrow(userId);
  return AuditLog.findAll({
    where: {
      [Op.or]: [
        { actorId: userId },
        { entityType: "user", entityId: userId },
      ],
    },
    include: [{ model: User, as: "actor", attributes: ["id", "email", "displayName"] }],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
}
