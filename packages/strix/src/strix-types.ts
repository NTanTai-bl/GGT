import type { ScanMode } from "@pentest/shared";

export interface LlmConfig {
  strixLlm: string;
  apiKey?: string | undefined;
  apiBase?: string | undefined;
}

export interface PentestInput {
  runId: string;
  target: string;
  scanMode: ScanMode;
  instruction?: string | undefined;
}

export interface PentestEngineResult {
  strixRunId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** Unparsed findings straight off stdout — normalize before persisting. */
  rawFindings: unknown[];
  /** True if rawFindings could not be confidently parsed from stdout. */
  parseWarning: boolean;
}

/**
 * A single finding as Strix may emit it. Shape is defensive/best-effort —
 * Strix's own output schema is not guaranteed stable across versions.
 */
export interface RawStrixFinding {
  [key: string]: unknown;
}

/** Engine abstraction — nothing outside packages/strix should import child_process for pentests. */
export interface PentestEngine {
  run(input: PentestInput): Promise<PentestEngineResult>;
  cancel(strixRunId: string): Promise<void>;
}
