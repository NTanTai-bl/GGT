import { loadSourceContext } from "./source-context";
import { sanitizeFinding } from "./sanitizer";
import type { AiReviewArtifact, ReviewerRuntime, ReviewedFinding } from "./types";

export async function reviewRunFindings(input: {
  runId: string;
  rawFindings: unknown[];
  workspaceDir: string;
  /** Extra directories holding the scanned source (S3 extract, git checkouts, Strix clones). */
  sourceRoots?: string[];
  runtime: ReviewerRuntime;
}): Promise<AiReviewArtifact> {
  const acceptedFindings: ReviewedFinding[] = [];
  const rejectedFindings: ReviewedFinding[] = [];
  const errors: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCostUsd = 0;

  const findings = input.rawFindings.slice(0, input.runtime.config.maxFindings);
  for (const [index, rawFinding] of findings.entries()) {
    const { finding, findingId } = identify(rawFinding, index);
    if (estimatedCostUsd >= input.runtime.config.maxBudgetUsd) {
      rejectedFindings.push(fallbackReview(finding, findingId, "Review budget exhausted"));
      continue;
    }

    try {
      const sourceContext = await loadSourceContext(rawFinding, input.workspaceDir, input.sourceRoots);
      const result = await input.runtime.reviewer.review({ finding, sourceContext });
      if (result.review.findingId !== findingId) {
        throw new Error(`Reviewer returned findingId ${result.review.findingId} for ${findingId}`);
      }
      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
      estimatedCostUsd = estimateCost(input.runtime, inputTokens, outputTokens);
      const reviewed = { finding, aiReview: result.review };
      if (result.review.decision === "ACCEPT") acceptedFindings.push(reviewed);
      else rejectedFindings.push(reviewed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reviewer error";
      errors.push(`${findingId}: ${message}`);
      rejectedFindings.push(fallbackReview(finding, findingId, message));
    }
  }

  for (const [offset, rawFinding] of input.rawFindings.slice(findings.length).entries()) {
    const { finding, findingId } = identify(rawFinding, findings.length + offset);
    rejectedFindings.push(fallbackReview(finding, findingId, "AI_REVIEW_MAX_FINDINGS exceeded"));
  }

  const needsHumanReview = rejectedFindings.filter((item) => item.aiReview.decision === "NEEDS_HUMAN_REVIEW").length;
  return {
    schemaVersion: "1.0",
    runId: input.runId,
    sourceArtifact: "raw-strix-output.json",
    acceptedFindings,
    rejectedFindings,
    summary: {
      total: input.rawFindings.length,
      accepted: acceptedFindings.length,
      rejected: rejectedFindings.filter((item) => item.aiReview.decision === "REJECT").length,
      needsHumanReview,
    },
    reviewMetadata: {
      status: errors.length === 0 ? "COMPLETED" : errors.length < findings.length ? "PARTIAL" : "FAILED",
      provider: input.runtime.config.provider,
      model: input.runtime.config.model,
      promptVersion: input.runtime.config.promptVersion,
      reviewedAt: new Date().toISOString(),
      inputTokens,
      outputTokens,
      estimatedCostUsd: hasPricing(input.runtime) ? Number(estimatedCostUsd.toFixed(6)) : null,
      errors,
    },
  };
}

/**
 * The reviewer must echo `findingId` back, so the id has to be part of the
 * finding it is shown. Strix findings without their own `id` get a stable
 * positional id that is written into the sanitized finding.
 */
function identify(rawFinding: unknown, index: number): { finding: Record<string, unknown>; findingId: string } {
  const finding = sanitizeFinding(rawFinding);
  const ownId = typeof finding.id === "string" || typeof finding.id === "number" ? String(finding.id).trim() : "";
  const findingId = ownId || `finding-${index + 1}`;
  finding.id = findingId;
  return { finding, findingId };
}

function fallbackReview(finding: Record<string, unknown>, findingId: string, reason: string): ReviewedFinding {
  return {
    finding,
    aiReview: {
      findingId,
      decision: "NEEDS_HUMAN_REVIEW",
      confidence: 0,
      recommendedSeverity: normalizeSeverity(finding.severity),
      reason: `Automated review could not complete: ${reason}`.slice(0, 4000),
      evidenceQuality: "NONE",
      reproducibility: "UNKNOWN",
      sourceAssessment: "Automated source assessment unavailable.",
      missingEvidence: ["Successful AI review"],
      developerAction: "Request human security review before closing or publishing this finding.",
      recommendedFix: "",
    },
  };
}

function normalizeSeverity(value: unknown): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" {
  const severity = String(value ?? "INFO").toUpperCase();
  return (["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).find((item) => item === severity) ?? "INFO";
}

function hasPricing(runtime: ReviewerRuntime): boolean {
  return runtime.config.inputCostPerMillionUsd !== undefined && runtime.config.outputCostPerMillionUsd !== undefined;
}

function estimateCost(runtime: ReviewerRuntime, inputTokens: number, outputTokens: number): number {
  if (!hasPricing(runtime)) return 0;
  return inputTokens / 1_000_000 * (runtime.config.inputCostPerMillionUsd ?? 0)
    + outputTokens / 1_000_000 * (runtime.config.outputCostPerMillionUsd ?? 0);
}
