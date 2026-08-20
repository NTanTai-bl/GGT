import type { LlmConfig, PentestInput } from "./strix-types";

export function loadLlmConfigFromEnv(): LlmConfig {
  const strixLlm = process.env.STRIX_LLM;
  if (!strixLlm) {
    throw new Error(
      "STRIX_LLM is not set. Example dev value: STRIX_LLM=openrouter/free"
    );
  }
  return {
    strixLlm,
    apiKey: process.env.LLM_API_KEY || undefined,
    apiBase: process.env.LLM_API_BASE || undefined,
  };
}

export function strixBinaryFromEnv(): string {
  return process.env.STRIX_BIN || "strix";
}

export function strixTimeoutMsFromEnv(): number {
  return Number(process.env.STRIX_TIMEOUT_MS || 30 * 60 * 1000);
}

/**
 * Builds the Strix CLI argument array. Deliberately an array, never a
 * shell string — untrusted target/instruction values must never be
 * concatenated into a command line.
 */
export function buildStrixArgs(input: PentestInput): string[] {
  const args = [
    "--target",
    input.target,
    "--scan-mode",
    input.scanMode.toLowerCase(),
    "--non-interactive",
  ];
  if (input.instruction) {
    args.push("--instruction", input.instruction);
  }
  return args;
}

/**
 * Env vars passed to the spawned Strix process. LLM credentials travel
 * through the environment, never as CLI args, so they never show up in
 * `ps`/process-list output.
 */
export function buildStrixEnv(llmConfig: LlmConfig): NodeJS.ProcessEnv {
  return {
    ...process.env,
    STRIX_LLM: llmConfig.strixLlm,
    LLM_API_KEY: llmConfig.apiKey ?? "",
    LLM_API_BASE: llmConfig.apiBase ?? "",
  };
}
