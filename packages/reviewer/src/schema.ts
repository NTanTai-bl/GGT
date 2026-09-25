import { z } from "zod";
import { EVIDENCE_QUALITIES, REPRODUCIBILITY_VALUES, REVIEW_DECISIONS } from "./types";

export const findingReviewSchema = z.object({
  findingId: z.string().min(1),
  decision: z.enum(REVIEW_DECISIONS),
  confidence: z.number().min(0).max(1),
  recommendedSeverity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
  reason: z.string().min(1).max(4000),
  evidenceQuality: z.enum(EVIDENCE_QUALITIES),
  reproducibility: z.enum(REPRODUCIBILITY_VALUES),
  sourceAssessment: z.string().min(1).max(4000),
  missingEvidence: z.array(z.string().max(1000)).max(20),
  developerAction: z.string().min(1).max(4000),
  recommendedFix: z.string().max(4000),
}).strict();

export const findingReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "findingId",
    "decision",
    "confidence",
    "recommendedSeverity",
    "reason",
    "evidenceQuality",
    "reproducibility",
    "sourceAssessment",
    "missingEvidence",
    "developerAction",
    "recommendedFix",
  ],
  properties: {
    findingId: { type: "string" },
    decision: { type: "string", enum: [...REVIEW_DECISIONS] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    recommendedSeverity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] },
    reason: { type: "string" },
    evidenceQuality: { type: "string", enum: [...EVIDENCE_QUALITIES] },
    reproducibility: { type: "string", enum: [...REPRODUCIBILITY_VALUES] },
    sourceAssessment: { type: "string" },
    missingEvidence: { type: "array", items: { type: "string" } },
    developerAction: { type: "string" },
    recommendedFix: { type: "string" },
  },
} as const;
