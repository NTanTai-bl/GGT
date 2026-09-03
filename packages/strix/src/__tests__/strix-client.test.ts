import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawn } from "node:child_process";
import { executeStrix } from "../strix-client";

jest.mock("node:child_process", () => ({ spawn: jest.fn() }));

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: jest.Mock };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = jest.fn();
  return child;
}

describe("executeStrix", () => {
  it("spawns with cwd set to the run's workspace, so ./strix_runs/ lands there", async () => {
    const child = fakeChild();
    (spawn as jest.Mock).mockReturnValue(child);

    const promise = executeStrix({
      binary: "strix",
      args: ["-n", "-t", "https://example.com", "--scan-mode", "quick"],
      env: {},
      timeoutMs: 5000,
      cwd: "/opt/ggt/workspaces/run-1",
    });

    child.emit("close", 0);
    await promise;

    expect(spawn).toHaveBeenCalledWith(
      "strix",
      ["-n", "-t", "https://example.com", "--scan-mode", "quick"],
      expect.objectContaining({ cwd: "/opt/ggt/workspaces/run-1", shell: false })
    );
  });

  it("resolves with the exit code, captured stdout/stderr, and a duration", async () => {
    const child = fakeChild();
    (spawn as jest.Mock).mockReturnValue(child);

    const promise = executeStrix({ binary: "strix", args: [], env: {}, timeoutMs: 5000 });
    child.stdout.emit("data", Buffer.from("hello"));
    child.stderr.emit("data", Buffer.from("warn"));
    child.emit("close", 2);

    const result = await promise;
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("hello");
    expect(result.stderr).toBe("warn");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("streams stdout and stderr through optional callbacks while retaining the captured output", async () => {
    const child = fakeChild();
    (spawn as jest.Mock).mockReturnValue(child);
    const onStdout = jest.fn();
    const onStderr = jest.fn();

    const promise = executeStrix({
      binary: "strix",
      args: [],
      env: {},
      timeoutMs: 5000,
      onStdout,
      onStderr,
    });
    child.stdout.emit("data", Buffer.from("progress\n"));
    child.stderr.emit("data", Buffer.from("warning\n"));
    child.emit("close", 0);

    const result = await promise;
    expect(onStdout).toHaveBeenCalledWith("progress\n");
    expect(onStderr).toHaveBeenCalledWith("warning\n");
    expect(result.stdout).toBe("progress\n");
    expect(result.stderr).toBe("warning\n");
  });
});
