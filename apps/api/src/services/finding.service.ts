import { Finding, recordAuditLog, Run } from "@pentest/database";
import { can, type FindingStatus, type UpdateFindingInput, type UserRole } from "@pentest/shared";
import { HttpError } from "../middleware/errorHandler";
import { getPentestOrThrow } from "./pentest.service";
import type { AuthenticatedUser } from "../middleware/auth";

export async function listFindingsForRun(runId: string, user: AuthenticatedUser): Promise<Finding[]> {
  await getPentestOrThrow(runId, user);
  return Finding.findAll({ where: { runId }, order: [["severity", "ASC"], ["createdAt", "ASC"]] });
}

export async function getFindingOrThrow(findingId: string, user: AuthenticatedUser): Promise<Finding> {
  const finding = await Finding.findByPk(findingId);
  if (!finding) {
    throw new HttpError(404, "Finding not found");
  }
  await getPentestOrThrow(finding.runId, user);
  return finding;
}

export async function updateFinding(
  findingId: string,
  input: UpdateFindingInput,
  user: AuthenticatedUser
): Promise<Finding> {
  const finding = await getFindingOrThrow(findingId, user);
  if (!input.status) {
    return finding;
  }

  if (!canSetFindingStatus(user.role, input.status)) {
    throw new HttpError(403, `Role ${user.role} cannot set a finding's status to ${input.status}`);
  }

  const previousStatus = finding.status;
  await finding.update({ status: input.status });
  await recordAuditLog({
    actorId: user.id,
    action: mapStatusToAuditAction(input.status),
    entityType: "finding",
    entityId: findingId,
    metadata: { from: previousStatus, to: input.status },
  });
  return finding;
}

/** Spec §25: SECURITY/ADMIN can set any status; DEVELOPER only FIXED_PENDING_RETEST. */
function canSetFindingStatus(role: UserRole, status: FindingStatus): boolean {
  if (can(role, "FINDING_UPDATE_ANY_STATUS")) return true;
  return status === "FIXED_PENDING_RETEST" && can(role, "FINDING_MARK_FIXED_PENDING_RETEST");
}

/** Spec §26 only names three finding-related audit actions; VERIFIED_FIXED reuses FINDING_MARKED_FIXED. */
function mapStatusToAuditAction(status: FindingStatus): string {
  switch (status) {
    case "CONFIRMED":
      return "FINDING_CONFIRMED";
    case "FALSE_POSITIVE":
      return "FINDING_FALSE_POSITIVE";
    case "FIXED_PENDING_RETEST":
    case "VERIFIED_FIXED":
      return "FINDING_MARKED_FIXED";
    default:
      return "FINDING_STATUS_CHANGED";
  }
}

export interface PentestReport {
  run: Run;
  findings: Finding[];
  summary: Record<string, number>;
}

export async function buildReport(runId: string, user: AuthenticatedUser): Promise<PentestReport> {
  const run = await getPentestOrThrow(runId, user); // already includes `targets`
  const findings = await Finding.findAll({ where: { runId } });

  const summary: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const finding of findings) {
    summary[finding.severity] = (summary[finding.severity] ?? 0) + 1;
  }

  return { run, findings, summary };
}
