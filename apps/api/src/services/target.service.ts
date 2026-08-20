import { Target } from "@pentest/database";
import type { CreateTargetInput } from "@pentest/shared";
import { getProjectOrThrow } from "./project.service";

export async function createTarget(
  projectId: string,
  input: CreateTargetInput,
  confirmedBy: string
): Promise<Target> {
  await getProjectOrThrow(projectId); // 404s if the project doesn't exist

  // Belt and suspenders: even though the schema validates this is `true`,
  // a run must never be startable against a target where this is false.
  return Target.create({
    projectId,
    type: input.type,
    target: input.target,
    environment: input.environment,
    authorizationConfirmed: input.authorizationConfirmed,
    authorizationConfirmedBy: confirmedBy,
    authorizationConfirmedAt: new Date(),
  });
}

export async function listTargets(projectId: string): Promise<Target[]> {
  await getProjectOrThrow(projectId);
  return Target.findAll({ where: { projectId }, order: [["createdAt", "DESC"]] });
}
