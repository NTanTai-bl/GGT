import type { LlmConfig, PentestInput } from "./strix-types";

/**
 * Builds the Strix CLI argument array — never a shell string. Untrusted
 * values (target paths/URLs, instructions) flow through this array, which
 * Node passes to the OS directly with no shell interpolation.
 *
 * CONFIRMED against a real `strix --help` (Strix Multi-Agent Cybersecurity
 * Penetration Testing Tool): `-n`/`--non-interactive`, repeated
 * `-t`/`--target <target>` for multi-target scans, `-m`/`--scan-mode
 * {quick,standard,deep}`, and `--instruction <text>` are all real flags
 * with exactly this shape. `--instruction-file <path>` also exists as an
 * alternative for long instructions but isn't needed here. Strix 1.2+
 * supports `--max-budget <USD>` as a per-run estimated LLM spend cap.
 *
 * STILL UNCONFIRMED: exit code semantics (0/1/2) — `--help` doesn't
 * document these, so this remains the spec's own hedged assumption
 * ("if the installed version uses...").
 */
export function buildStrixArgs(input: PentestInput, maxBudgetUsd?: number): string[] {
  const args: string[] = ["-n"];

  for (const target of input.targets) {
    const targetValue =
      target.type === "SOURCE"
        ? "path" in target
          ? target.path
          : target.repositoryUrl
        : target.url;
    args.push("-t", targetValue);
  }

  args.push("--scan-mode", input.scanMode.toLowerCase());

  if (maxBudgetUsd !== undefined) {
    args.push("--max-budget", String(maxBudgetUsd));
  }

  if (input.instruction) {
    args.push("--instruction", input.instruction);
  }

  return args;
}

/**
 * Env vars passed to the spawned Strix process. Credentials (LLM and,
 * for AUTHENTICATED scans, the retrieved test-account secret) travel
 * through the environment or a short-lived file referenced by env, never
 * as CLI args — so they never show up in `ps`/process-list output.
 *
 * UNCONFIRMED: `strix --help` shows a `--config CONFIG` flag documented
 * as "instead of ~/.strix/cli-config.json" — which suggests LLM provider
 * selection may be config-file-based rather than env-var-based. Nothing
 * in `--help` confirms or denies that STRIX_LLM/LLM_API_KEY/LLM_API_BASE
 * are read at all. This is the single biggest open question blocking
 * "does Bedrock/OpenRouter selection actually work" — see
 * docs/known-limitations.md.
 */
export function buildStrixEnv(
  llmConfig: LlmConfig,
  extraEnv?: Record<string, string>
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    STRIX_LLM: llmConfig.strixLlm,
    LLM_API_KEY: llmConfig.apiKey ?? "",
    LLM_API_BASE: llmConfig.apiBase ?? "",
    // Mandatory per spec §4 — GGT is internal-only and must not phone home.
    STRIX_TELEMETRY: "0",
    ...extraEnv,
  };
}
