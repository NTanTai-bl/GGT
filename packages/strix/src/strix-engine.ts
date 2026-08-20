import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { buildStrixArgs, buildStrixEnv } from "./strix-command-builder";
import { strixBinaryFromEnv, strixTimeoutMsFromEnv } from "./strix-config";
import { executeStrix, killStrixProcess } from "./strix-client";
import { collectStrixResults } from "./strix-result-parser";
import type { LlmConfig, PentestEngine, PentestEngineResult, PentestInput } from "./strix-types";

export class StrixPentestEngine implements PentestEngine {
  private readonly runningProcesses = new Map<string, ChildProcess>();

  constructor(private readonly llmConfig: LlmConfig) {}

  async run(input: PentestInput): Promise<PentestEngineResult> {
    const strixRunId = randomUUID();
    const args = buildStrixArgs(input);
    const env = buildStrixEnv(this.llmConfig, input.extraEnv);
    const binary = strixBinaryFromEnv();
    const timeoutMs = strixTimeoutMsFromEnv();

    try {
      const execution = await executeStrix({
        binary,
        args,
        env,
        timeoutMs,
        // Strix writes ./strix_runs/<run-name>/ relative to its cwd — anchor
        // it to the run's own workspace so results land somewhere we
        // already track and clean up, not the worker process's cwd.
        cwd: input.workspaceDir,
        // Tracked by our own runId, not strixRunId — the caller only learns
        // strixRunId once run() resolves, but cancel() must work mid-flight.
        onProcessStart: (child) => this.runningProcesses.set(input.runId, child),
      });

      const { findings, parseWarning } = await collectStrixResults(execution.stdout, input.workspaceDir);

      return {
        strixRunId,
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr,
        durationMs: execution.durationMs,
        rawFindings: findings,
        parseWarning,
      };
    } finally {
      this.runningProcesses.delete(input.runId);
    }
  }

  async cancel(runId: string): Promise<void> {
    const child = this.runningProcesses.get(runId);
    if (child) {
      killStrixProcess(child);
      this.runningProcesses.delete(runId);
    }
  }
}
