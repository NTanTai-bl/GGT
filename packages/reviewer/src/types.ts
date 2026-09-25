export const REVIEW_DECISIONS = ["ACCEPT", "REJECT", "NEEDS_HUMAN_REVIEW"] as const;
export const EVIDENCE_QUALITIES = ["STRONG", "PARTIAL", "WEAK", "NONE"] as const;
export const REPRODUCIBILITY_VALUES = ["REPRODUCED", "REPRODUCIBLE", "NOT_REPRODUCIBLE", "UNKNOWN"] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export type EvidenceQuality = (typeof EVIDENCE_QUALITIES)[number];
export type Reproducibility = (typeof REPRODUCIBILITY_VALUES)[number];

export interface ReviewerConfig {
  enabled: boolean;
  provider: "bedrock" | "anthropic" | "openrouter";
  model: string;
  apiKey?: string;
  apiBase?: string;
  region: string;
  maxInputChars: number;
  maxOutputTokens: number;
  maxFindings: number;
  maxBudgetUsd: number;
  inputCostPerMillionUsd?: number;
  outputCostPerMillionUsd?: number;
  promptVersion: string;
}

export interface FindingReviewInput {
  finding: Record<string, unknown>;
  sourceContext: string;
}

export interface FindingReview {
  findingId: string;
  decision: ReviewDecision;
  confidence: number;
  recommendedSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  reason: string;
  evidenceQuality: EvidenceQuality;
  reproducibility: Reproducibility;
  sourceAssessment: string;
  missingEvidence: string[];
  developerAction: string;
  recommendedFix: string;
}

export interface ReviewUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ReviewResult {
  review: FindingReview;
  usage: ReviewUsage;
}

export interface AiReviewer {
  review(input: FindingReviewInput): Promise<ReviewResult>;
}

export interface ReviewedFinding {
  finding: Record<string, unknown>;
  aiReview: FindingReview;
}

export interface AiReviewArtifact {
  schemaVersion: "1.0";
  runId: string;
  sourceArtifact: "raw-strix-output.json";
  acceptedFindings: ReviewedFinding[];
  rejectedFindings: ReviewedFinding[];
  summary: {
    total: number;
    accepted: number;
    rejected: number;
    needsHumanReview: number;
  };
  reviewMetadata: {
    status: "COMPLETED" | "PARTIAL" | "FAILED";
    provider: ReviewerConfig["provider"];
    model: string;
    promptVersion: string;
    reviewedAt: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number | null;
    errors: string[];
  };
}

export interface ReviewerRuntime {
  config: ReviewerConfig;
  reviewer: AiReviewer;
}
