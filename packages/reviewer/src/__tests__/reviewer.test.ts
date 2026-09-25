import { findingReviewSchema } from "../schema";
import { sanitizeFinding, sanitizeText } from "../sanitizer";
import { reviewRunFindings } from "../review-run";
import { bedrockEndpoint, parseReview } from "../providers";
import { loadReviewerConfigFromEnv } from "../config";
import { loadSourceContext } from "../source-context";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ReviewerRuntime } from "../types";

describe("AI reviewer", () => {
  it("redacts credentials and only keeps allowlisted finding fields", () => {
    const sanitized = sanitizeFinding({
      id: "vuln-1",
      evidence: "Authorization: Bearer secret-token-value",
      agent_name: "untrusted metadata",
      password: "do-not-send",
    });

    expect(sanitized.evidence).toContain("[REDACTED]");
    expect(sanitized).not.toHaveProperty("password");
    expect(sanitized).not.toHaveProperty("agent_name");
    expect(sanitizeText("AKIA1234567890ABCDEF")).toBe("[REDACTED_AWS_ACCESS_KEY]");
  });

  it("rejects an invalid model decision", () => {
    expect(() => findingReviewSchema.parse({
      findingId: "vuln-1",
      decision: "CONFIRMED",
      confidence: 0.9,
      recommendedSeverity: "HIGH",
      reason: "reason",
      evidenceQuality: "STRONG",
      reproducibility: "REPRODUCIBLE",
      sourceAssessment: "assessment",
      missingEvidence: [],
      developerAction: "fix",
      recommendedFix: "parameterize",
    })).toThrow();
  });

  it("places accepted findings in the final list", async () => {
    const runtime: ReviewerRuntime = {
      config: {
        enabled: true,
        provider: "bedrock",
        model: "review-model",
        region: "us-east-1",
        maxInputChars: 60_000,
        maxOutputTokens: 2500,
        maxFindings: 50,
        maxBudgetUsd: 0.5,
        promptVersion: "v1",
      },
      reviewer: {
        review: jest.fn().mockResolvedValue({
          review: {
            findingId: "vuln-1",
            decision: "ACCEPT",
            confidence: 0.95,
            recommendedSeverity: "HIGH",
            reason: "Source concatenates untrusted input into SQL.",
            evidenceQuality: "STRONG",
            reproducibility: "REPRODUCIBLE",
            sourceAssessment: "Vulnerable code is present.",
            missingEvidence: [],
            developerAction: "Fix before release.",
            recommendedFix: "Use a parameterized query.",
          },
          usage: { inputTokens: 100, outputTokens: 50 },
        }),
      },
    };

    const artifact = await reviewRunFindings({
      runId: "run-1",
      rawFindings: [{ id: "vuln-1", title: "SQL injection", severity: "high" }],
      workspaceDir: process.cwd(),
      runtime,
    });

    expect(artifact.acceptedFindings).toHaveLength(1);
    expect(artifact.rejectedFindings).toHaveLength(0);
    expect(artifact.summary).toEqual({ total: 1, accepted: 1, rejected: 0, needsHumanReview: 0 });
  });

  it("fails closed to human review when the provider fails", async () => {
    const runtime: ReviewerRuntime = {
      config: {
        enabled: true,
        provider: "openrouter",
        model: "review-model",
        region: "us-east-1",
        maxInputChars: 60_000,
        maxOutputTokens: 2500,
        maxFindings: 50,
        maxBudgetUsd: 0.5,
        promptVersion: "v1",
      },
      reviewer: { review: jest.fn().mockRejectedValue(new Error("provider unavailable")) },
    };

    const artifact = await reviewRunFindings({
      runId: "run-1",
      rawFindings: [{ id: "vuln-1", title: "Candidate", severity: "medium" }],
      workspaceDir: process.cwd(),
      runtime,
    });

    expect(artifact.acceptedFindings).toHaveLength(0);
    expect(artifact.rejectedFindings[0]?.aiReview.decision).toBe("NEEDS_HUMAN_REVIEW");
    expect(artifact.reviewMetadata.status).toBe("FAILED");
  });
  const validReview = {
    findingId: "finding-1",
    decision: "ACCEPT",
    confidence: 0.9,
    recommendedSeverity: "HIGH",
    reason: "reason",
    evidenceQuality: "STRONG",
    reproducibility: "REPRODUCIBLE",
    sourceAssessment: "assessment",
    missingEvidence: [],
    developerAction: "fix",
    recommendedFix: "parameterize",
  };

  it("gives findings without an id a positional id the reviewer can echo back", async () => {
    const review = jest.fn().mockResolvedValue({ review: validReview, usage: { inputTokens: 1, outputTokens: 1 } });
    const runtime: ReviewerRuntime = {
      config: {
        enabled: true,
        provider: "bedrock",
        model: "review-model",
        region: "us-east-1",
        maxInputChars: 60_000,
        maxOutputTokens: 2500,
        maxFindings: 50,
        maxBudgetUsd: 0.5,
        promptVersion: "v1",
      },
      reviewer: { review },
    };

    const artifact = await reviewRunFindings({
      runId: "run-1",
      rawFindings: [{ title: "SQL injection", severity: "high" }],
      workspaceDir: process.cwd(),
      runtime,
    });

    expect(review).toHaveBeenCalledWith(expect.objectContaining({ finding: expect.objectContaining({ id: "finding-1" }) }));
    expect(artifact.acceptedFindings).toHaveLength(1);
    expect(artifact.reviewMetadata.errors).toEqual([]);
  });

  it("extracts the review JSON when the model wraps it in prose", () => {
    const text = `Here is my review:\n${JSON.stringify(validReview)}\nThanks.`;
    expect(parseReview(text).decision).toBe("ACCEPT");
    expect(() => parseReview("no json here")).toThrow("invalid JSON");
  });

  it("treats empty AI_REVIEW_* variables as unset", () => {
    const config = loadReviewerConfigFromEnv({
      AI_REVIEW_ENABLED: "false",
      AI_REVIEW_API_BASE: "",
      AI_REVIEW_INPUT_COST_PER_MILLION_USD: "",
    });
    expect(config.apiBase).toBeUndefined();
    expect(config.inputCostPerMillionUsd).toBeUndefined();
  });

  it("does not send Bedrock traffic to the LocalStack AWS_ENDPOINT_URL", () => {
    expect(bedrockEndpoint("us-east-1", { AWS_ENDPOINT_URL: "http://localstack:4566" })).toBe(
      "https://bedrock-runtime.us-east-1.amazonaws.com"
    );
    expect(
      bedrockEndpoint("us-east-1", {
        AWS_ENDPOINT_URL: "http://localstack:4566",
        AWS_ENDPOINT_URL_BEDROCK_RUNTIME: "https://bedrock-runtime.example",
      })
    ).toBe("https://bedrock-runtime.example");
    expect(bedrockEndpoint("us-east-1", {})).toBeUndefined();
  });
  it("reads code_locations files from extra source roots such as a Strix clone", async () => {
    const clone = mkdtempSync(path.join(tmpdir(), "ggt-clone-"));
    mkdirSync(path.join(clone, "src"));
    writeFileSync(path.join(clone, "src", "server.js"), "app.get('/admin', handler)");
    const workspace = mkdtempSync(path.join(tmpdir(), "ggt-ws-"));

    const context = await loadSourceContext(
      { code_locations: [{ file: "src/server.js", start_line: 1, end_line: 1 }] },
      workspace,
      [clone]
    );

    expect(context).toContain("app.get('/admin', handler)");
  });
});
