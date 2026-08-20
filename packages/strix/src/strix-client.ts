import { spawn, type ChildProcess } from "node:child_process";

export interface StrixExecution {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface StrixExecuteOptions {
  binary: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  /**
   * Working directory for the spawned process. Strix writes its own
   * `./strix_runs/<run-name>/` output relative to its cwd (confirmed by
   * `strix --help`'s `--resume` description) — pass the run's workspace
   * dir here so that output lands somewhere this codebase already tracks
   * and cleans up, instead of the worker process's own cwd.
   */
  cwd?: string;
  /** Called with the spawned process so the caller can track it for cancellation. */
  onProcessStart?: (child: ChildProcess) => void;
}

/**
 * Spawns the Strix CLI with an argument array — never a shell string.
 * `target`/`instruction` values flow through `args`, which node passes to
 * the OS directly (no shell interpolation), so they cannot break out into
 * additional shell commands.
 */
export function executeStrix(options: StrixExecuteOptions): Promise<StrixExecution> {
  const { binary, args, env, timeoutMs, cwd, onProcessStart } = options;
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      env,
      cwd,
      shell: false,
    });
    onProcessStart?.(child);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      if (timedOut) {
        reject(new Error(`Strix execution timed out after ${timeoutMs}ms`));
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? 1, durationMs });
    });
  });
}

export function killStrixProcess(child: ChildProcess): void {
  try {
    child.kill("SIGTERM");
  } catch {
    // process may have already exited — cancel is best-effort
  }
}
