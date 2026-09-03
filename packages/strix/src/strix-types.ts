import type { ScanMode, ScanType } from "@pentest/shared";

export interface LlmConfig {
  /** e.g. "bedrock/anthropic.claude-..." in prod, "openrouter/free" for local dev. */
  strixLlm: string;
  /** Must stay undefined for Bedrock — auth is via the EC2/IAM role, never a key. */
  apiKey?: string | undefined;
  apiBase?: string | undefined;
}

export type StrixTargetInput =
  | { type: "SOURCE"; path: string } // resolved local workspace path from an S3 source archive
  | { type: "SOURCE"; repositoryUrl: string } // validated, explicitly authorized GitHub repository
  | { type: "WEB" | "API"; url: string };

export interface PentestInput {
  runId: string;
  scanType: ScanType;
  scanMode: ScanMode;
  targets: StrixTargetInput[];
  instruction?: string | undefined;
  /**
   * Extra env vars merged into the child process — e.g. a path to a
   * short-lived credential file the worker wrote for an AUTHENTICATED scan.
   * Never put a credential VALUE directly here as a CLI arg or in `targets`.
   */
  extraEnv?: Record<string, string> | undefined;
  /**
   * The run's workspace directory (spec §28: <STRIX_WORKSPACE_ROOT>/<runId>/).
   * When set, result collection looks here for structured output (run.json,
   * vulnerabilities.json, SARIF) before falling back to scraping stdout.
   */
  workspaceDir?: string | undefined;
}

export interface PentestEngineResult {
  strixRunId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** Unparsed findings straight off stdout/result files — normalize before persisting. */
  rawFindings: unknown[];
  /** True if rawFindings could not be confidently parsed. */
  parseWarning: boolean;
}

export interface StrixProcessStartEvent {
  runId: string;
  scanMode: ScanMode;
  targetCount: number;
  maxBudgetUsd: number;
  timeoutMs: number;
}

export interface StrixOutputEvent {
  runId: string;
  stream: "stdout" | "stderr";
  chunk: string;
}

export interface StrixProcessFinishEvent {
  runId: string;
  exitCode: number;
  durationMs: number;
}

/** Optional, infrastructure-owned hooks for structured live process logs. */
export interface StrixRunObserver {
  onStart?(event: StrixProcessStartEvent): void;
  onOutput?(event: StrixOutputEvent): void;
  onFinish?(event: StrixProcessFinishEvent): void;
}

/**
 * A single finding as Strix may emit it. Shape is defensive/best-effort —
 * Strix's own output schema is not guaranteed stable across versions.
 */
export interface RawStrixFinding {
  [key: string]: unknown;
}

/** Engine abstraction — nothing outside packages/strix should invoke the Strix CLI directly. */
export interface PentestEngine {
  run(input: PentestInput): Promise<PentestEngineResult>;
  cancel(runId: string): Promise<void>;
}
