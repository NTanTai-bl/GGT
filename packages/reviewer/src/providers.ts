import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { buildReviewerPrompt, REVIEWER_SYSTEM_PROMPT } from "./prompt";
import { findingReviewSchema } from "./schema";
import type { AiReviewer, FindingReviewInput, ReviewResult, ReviewerConfig } from "./types";

export function createAiReviewer(config: ReviewerConfig): AiReviewer {
  if (config.provider === "bedrock") return new BedrockReviewer(config);
  return new HttpReviewer(config);
}

class BedrockReviewer implements AiReviewer {
  private readonly client: BedrockRuntimeClient;

  constructor(private readonly config: ReviewerConfig) {
    this.client = new BedrockRuntimeClient({ region: config.region, endpoint: bedrockEndpoint(config.region) });
  }

  async review(input: FindingReviewInput): Promise<ReviewResult> {
    const response = await this.client.send(new ConverseCommand({
      modelId: this.config.model,
      system: [{ text: REVIEWER_SYSTEM_PROMPT }],
      messages: [{ role: "user", content: [{ text: buildReviewerPrompt(input).slice(0, this.config.maxInputChars) }] }],
      inferenceConfig: { maxTokens: this.config.maxOutputTokens, temperature: 0 },
    }));
    const text = response.output?.message?.content?.map((block) => block.text ?? "").join("") ?? "";
    return {
      review: parseReview(text),
      usage: { inputTokens: response.usage?.inputTokens ?? 0, outputTokens: response.usage?.outputTokens ?? 0 },
    };
  }
}

/**
 * The AWS SDK applies the global AWS_ENDPOINT_URL to every client. Local dev
 * points that at LocalStack for SQS/S3/Secrets Manager, which cannot serve
 * Bedrock, so unless a Bedrock-specific endpoint is configured, talk to the
 * real regional Bedrock Runtime endpoint.
 */
export function bedrockEndpoint(region: string, source: NodeJS.ProcessEnv = process.env): string | undefined {
  const specific = source.AWS_ENDPOINT_URL_BEDROCK_RUNTIME?.trim();
  if (specific) return specific;
  if (source.AWS_ENDPOINT_URL?.trim()) return `https://bedrock-runtime.${region}.amazonaws.com`;
  return undefined;
}

class HttpReviewer implements AiReviewer {
  constructor(private readonly config: ReviewerConfig) {}

  async review(input: FindingReviewInput): Promise<ReviewResult> {
    if (this.config.provider === "anthropic") return this.reviewWithAnthropic(input);
    return this.reviewWithOpenRouter(input);
  }

  private async reviewWithAnthropic(input: FindingReviewInput): Promise<ReviewResult> {
    const base = this.config.apiBase ?? "https://api.anthropic.com/v1";
    const response = await fetch(`${base.replace(/\/$/, "")}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxOutputTokens,
        temperature: 0,
        system: REVIEWER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildReviewerPrompt(input).slice(0, this.config.maxInputChars) }],
      }),
    });
    const body = await readJsonResponse(response);
    const content = Array.isArray(body.content) ? body.content : [];
    const text = content.map((item) => {
      const value = asRecord(item).text;
      return typeof value === "string" ? value : "";
    }).join("");
    const usage = asRecord(body.usage);
    return {
      review: parseReview(String(text)),
      usage: { inputTokens: Number(usage.input_tokens ?? 0), outputTokens: Number(usage.output_tokens ?? 0) },
    };
  }

  private async reviewWithOpenRouter(input: FindingReviewInput): Promise<ReviewResult> {
    const base = this.config.apiBase ?? "https://openrouter.ai/api/v1";
    const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey ?? ""}` },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxOutputTokens,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: REVIEWER_SYSTEM_PROMPT },
          { role: "user", content: buildReviewerPrompt(input).slice(0, this.config.maxInputChars) },
        ],
      }),
    });
    const body = await readJsonResponse(response);
    const choices = Array.isArray(body.choices) ? body.choices : [];
    const message = asRecord(asRecord(choices[0]).message);
    const usage = asRecord(body.usage);
    return {
      review: parseReview(typeof message.content === "string" ? message.content : ""),
      usage: { inputTokens: Number(usage.prompt_tokens ?? 0), outputTokens: Number(usage.completion_tokens ?? 0) },
    };
  }
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!response.ok) throw new Error(`AI reviewer request failed (${response.status}): ${text.slice(0, 500)}`);
  try {
    return asRecord(JSON.parse(text));
  } catch {
    throw new Error("AI reviewer returned a non-JSON HTTP response");
  }
}

export function parseReview(text: string) {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed)?.[1];
  const candidates = [trimmed, fenced, outermostObject(trimmed)].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    let value: unknown;
    try {
      value = JSON.parse(candidate);
    } catch {
      continue;
    }
    return findingReviewSchema.parse(value);
  }
  throw new Error("AI reviewer returned invalid JSON");
}

/** Models sometimes wrap the JSON object in a sentence; take the outermost {...}. */
function outermostObject(text: string): string | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
