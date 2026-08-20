import { Finding, Run, Target } from "@pentest/database";
import type { UpdateFindingInput } from "@pentest/shared";
import { HttpError } from "../middleware/errorHandler";
import { getPentestOrThrow } from "./pentest.service";

export async function listFindingsForRun(runId: string): Promise<Finding[]> {
  await getPentestOrThrow(runId);
  return Finding.findAll({ where: { runId }, order: [["severity", "ASC"], ["createdAt", "ASC"]] });
}

export async function getFindingOrThrow(findingId: string): Promise<Finding> {
  const finding = await Finding.findByPk(findingId);
  if (!finding) {
    throw new HttpError(404, "Finding not found");
  }
  return finding;
}

export async function updateFinding(findingId: string, input: UpdateFindingInput): Promise<Finding> {
  const finding = await getFindingOrThrow(findingId);
  if (input.status) {
    await finding.update({ status: input.status });
  }
  return finding;
}

export interface PentestReport {
  run: Run;
  target: Target | null;
  findings: Finding[];
  summary: Record<string, number>;
}

export async function buildReport(runId: string): Promise<PentestReport> {
  const run = await getPentestOrThrow(runId);
  const [target, findings] = await Promise.all([
    Target.findByPk(run.targetId),
    Finding.findAll({ where: { runId } }),
  ]);

  const summary: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const finding of findings) {
    summary[finding.severity] = (summary[finding.severity] ?? 0) + 1;
  }

  return { run, target, findings, summary };
}
