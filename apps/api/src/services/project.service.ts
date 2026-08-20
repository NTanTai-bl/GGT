import { Project, ProjectMember, recordAuditLog, Target, User } from "@pentest/database";
import type { CreateProjectInput, UpdateProjectInput } from "@pentest/shared";
import { HttpError } from "../middleware/errorHandler";

export async function createProject(input: CreateProjectInput, createdBy: string): Promise<Project> {
  const project = await Project.create({
    name: input.name,
    description: input.description ?? null,
    createdBy,
  });
  // The creator is always a member — otherwise a DEVELOPER/VIEWER creator
  // (if ever allowed) would immediately be locked out of their own project.
  await ProjectMember.create({ projectId: project.id, userId: createdBy, addedBy: createdBy });
  await recordAuditLog({
    actorId: createdBy,
    action: "PROJECT_CREATED",
    entityType: "project",
    entityId: project.id,
    metadata: { name: project.name },
  });
  return project;
}

/** ADMIN/SECURITY see every project; DEVELOPER/VIEWER see only projects they're a member of. */
export async function listProjects(user: { id: string; role: string }): Promise<Project[]> {
  if (user.role === "ADMIN" || user.role === "SECURITY") {
    return Project.findAll({ order: [["createdAt", "DESC"]] });
  }
  const memberships = await ProjectMember.findAll({ where: { userId: user.id } });
  const projectIds = memberships.map((m) => m.projectId);
  return Project.findAll({ where: { id: projectIds }, order: [["createdAt", "DESC"]] });
}

export async function getProjectOrThrow(projectId: string): Promise<Project> {
  const project = await Project.findByPk(projectId, {
    include: [
      { model: Target, as: "targets" },
      { model: ProjectMember, as: "memberships", include: [{ model: User, as: "user" }] },
    ],
  });
  if (!project) {
    throw new HttpError(404, "Project not found");
  }
  return project;
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  actorId: string
): Promise<Project> {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  if (input.name !== undefined || input.description !== undefined) {
    await project.update({
      name: input.name ?? project.name,
      description: input.description ?? project.description,
    });
  }

  if (input.memberIds) {
    const existing = await ProjectMember.findAll({ where: { projectId } });
    const existingUserIds = new Set(existing.map((m) => m.userId));
    const nextUserIds = new Set(input.memberIds);

    const toAdd = input.memberIds.filter((id) => !existingUserIds.has(id));
    const toRemove = existing.filter((m) => !nextUserIds.has(m.userId));

    await Promise.all([
      ...toAdd.map((userId) => ProjectMember.create({ projectId, userId, addedBy: actorId })),
      ...toRemove.map((m) => m.destroy()),
    ]);
  }

  await recordAuditLog({ actorId, action: "PROJECT_UPDATED", entityType: "project", entityId: projectId });
  return getProjectOrThrow(projectId);
}
