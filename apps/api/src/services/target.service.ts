import { recordAuditLog, Target } from "@pentest/database";
import type { UpdateTargetInput, CreateTargetInput } from "@pentest/shared";
import { HttpError } from "../middleware/errorHandler";
import { getProjectOrThrow } from "./project.service";

export async function createTarget(
  projectId: string,
  input: CreateTargetInput,
  confirmedBy: string
): Promise<Target> {
  await getProjectOrThrow(projectId); // 404s if the project doesn't exist

  // Belt and suspenders: even though the schema validates this is `true`,
  // a run must never be startable against a target where this is false.
  const target = await Target.create({
    projectId,
    type: input.type,
    target: input.target,
    environment: input.environment,
    branch: input.branch ?? null,
    commitSha: input.commitSha ?? null,
    authorizationConfirmed: input.authorizationConfirmed,
    authorizationConfirmedBy: confirmedBy,
    authorizationConfirmedAt: new Date(),
  });

  await recordAuditLog({
    actorId: confirmedBy,
    action: "TARGET_CREATED",
    entityType: "target",
    entityId: target.id,
    metadata: { type: target.type, environment: target.environment },
  });
  await recordAuditLog({
    actorId: confirmedBy,
    action: "TARGET_AUTHORIZED",
    entityType: "target",
    entityId: target.id,
  });

  return target;
}

export async function listTargets(projectId: string): Promise<Target[]> {
  await getProjectOrThrow(projectId);
  return Target.findAll({ where: { projectId }, order: [["createdAt", "DESC"]] });
}

export async function getTargetOrThrow(targetId: string): Promise<Target> {
  const target = await Target.findByPk(targetId);
  if (!target) {
    throw new HttpError(404, "Target not found");
  }
  return target;
}

export async function updateTarget(targetId: string, input: UpdateTargetInput, actorId: string): Promise<Target> {
  const target = await getTargetOrThrow(targetId);
  const wasAuthorized = target.authorizationConfirmed;

  await target.update({
    environment: input.environment ?? target.environment,
    branch: input.branch ?? target.branch,
    commitSha: input.commitSha ?? target.commitSha,
    ...(input.authorizationConfirmed !== undefined
      ? {
          authorizationConfirmed: input.authorizationConfirmed,
          authorizationConfirmedBy: input.authorizationConfirmed ? actorId : target.authorizationConfirmedBy,
          authorizationConfirmedAt: input.authorizationConfirmed ? new Date() : target.authorizationConfirmedAt,
        }
      : {}),
  });

  if (!wasAuthorized && target.authorizationConfirmed) {
    await recordAuditLog({ actorId, action: "TARGET_AUTHORIZED", entityType: "target", entityId: target.id });
  }

  return target;
}

export async function deleteTarget(targetId: string, actorId: string): Promise<void> {
  const target = await getTargetOrThrow(targetId);
  await target.destroy();
  await recordAuditLog({ actorId, action: "TARGET_DELETED", entityType: "target", entityId: targetId });
}
