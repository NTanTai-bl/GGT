import type { LlmConfig } from "./strix-types";

export function loadLlmConfigFromEnv(): LlmConfig {
  const strixLlm = process.env.STRIX_LLM;
  if (!strixLlm) {
    throw new Error(
      "STRIX_LLM is not set. Example: STRIX_LLM=bedrock/<approved-claude-model-id> (prod) " +
        "or STRIX_LLM=openrouter/free (local dev only)."
    );
  }
  if (strixLlm.startsWith("bedrock/") && process.env.LLM_API_KEY) {
    throw new Error(
      "LLM_API_KEY must not be set when using Bedrock — auth goes through the EC2/IAM role, not a key."
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

/** Root directory the worker creates <runId> workspaces under (spec §28: never an arbitrary path). */
export function strixWorkspaceRootFromEnv(): string {
  return process.env.STRIX_WORKSPACE_ROOT || "/opt/ggt/workspaces";
}
