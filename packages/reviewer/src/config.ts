import { z } from "zod";
import type { ReviewerConfig } from "./types";

const schema = z.object({
  AI_REVIEW_ENABLED: z.enum(["true", "false"]).default("false"),
  AI_REVIEW_PROVIDER: z.enum(["bedrock", "anthropic", "openrouter"]).default("bedrock"),
  AI_REVIEW_MODEL: z.string().default(""),
  AI_REVIEW_API_KEY: z.string().optional(),
  AI_REVIEW_API_BASE: z.string().url().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  AI_REVIEW_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(60_000),
  AI_REVIEW_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(2500),
  AI_REVIEW_MAX_FINDINGS: z.coerce.number().int().positive().default(50),
  AI_REVIEW_MAX_BUDGET_USD: z.coerce.number().positive().default(0.5),
  AI_REVIEW_INPUT_COST_PER_MILLION_USD: z.coerce.number().nonnegative().optional(),
  AI_REVIEW_OUTPUT_COST_PER_MILLION_USD: z.coerce.number().nonnegative().optional(),
  AI_REVIEW_PROMPT_VERSION: z.string().default("v1"),
});

export function loadReviewerConfigFromEnv(source: NodeJS.ProcessEnv = process.env): ReviewerConfig {
  // `AI_REVIEW_API_BASE=` (present but empty, as in the .env examples) means
  // "not set" — without this, .url() rejects it and the worker fails to boot,
  // and an empty price would silently coerce to 0.
  const withoutEmpty = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value === undefined || value.trim() !== "")
  );
  const parsed = schema.parse(withoutEmpty);
  const enabled = parsed.AI_REVIEW_ENABLED === "true";
  if (enabled && !parsed.AI_REVIEW_MODEL) throw new Error("AI_REVIEW_MODEL must be set when AI_REVIEW_ENABLED=true");
  const apiKey = parsed.AI_REVIEW_API_KEY || source.LLM_API_KEY || undefined;
  if (enabled && parsed.AI_REVIEW_PROVIDER !== "bedrock" && !apiKey) {
    throw new Error("AI_REVIEW_API_KEY must be set for Anthropic/OpenRouter AI review");
  }
  return {
    enabled,
    provider: parsed.AI_REVIEW_PROVIDER,
    model: parsed.AI_REVIEW_MODEL,
    apiKey,
    apiBase: parsed.AI_REVIEW_API_BASE,
    region: parsed.AWS_REGION,
    maxInputChars: parsed.AI_REVIEW_MAX_INPUT_CHARS,
    maxOutputTokens: parsed.AI_REVIEW_MAX_OUTPUT_TOKENS,
    maxFindings: parsed.AI_REVIEW_MAX_FINDINGS,
    maxBudgetUsd: parsed.AI_REVIEW_MAX_BUDGET_USD,
    inputCostPerMillionUsd: parsed.AI_REVIEW_INPUT_COST_PER_MILLION_USD,
    outputCostPerMillionUsd: parsed.AI_REVIEW_OUTPUT_COST_PER_MILLION_USD,
    promptVersion: parsed.AI_REVIEW_PROMPT_VERSION,
  };
}
