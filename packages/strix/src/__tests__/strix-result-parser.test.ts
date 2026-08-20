import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { collectStrixResults, parseStrixOutput } from "../strix-result-parser";

describe("parseStrixOutput", () => {
  it("parses a bare JSON array", () => {
    const stdout = JSON.stringify([{ title: "IDOR" }, { title: "XSS" }]);
    const result = parseStrixOutput(stdout);
    expect(result.parseWarning).toBe(false);
    expect(result.findings).toHaveLength(2);
  });

  it("parses an object with a findings key", () => {
    const stdout = JSON.stringify({ findings: [{ title: "SQLi" }] });
    const result = parseStrixOutput(stdout);
    expect(result.findings).toEqual([{ title: "SQLi" }]);
  });

  it("parses a fenced json block embedded in log output", () => {
    const stdout = [
      "[info] starting scan...",
      "```json",
      JSON.stringify([{ title: "Broken Auth" }]),
      "```",
      "[info] done",
    ].join("\n");
    const result = parseStrixOutput(stdout);
    expect(result.findings).toEqual([{ title: "Broken Auth" }]);
    expect(result.parseWarning).toBe(false);
  });

  it("parses line-delimited JSON findings", () => {
    const stdout = [
      "[info] scanning",
      JSON.stringify({ title: "A" }),
      JSON.stringify({ title: "B" }),
    ].join("\n");
    const result = parseStrixOutput(stdout);
    expect(result.findings).toEqual([{ title: "A" }, { title: "B" }]);
  });

  it("returns no findings with a parse warning for unrecognized output", () => {
    const result = parseStrixOutput("scan complete, no structured output emitted");
    expect(result.findings).toEqual([]);
    expect(result.parseWarning).toBe(true);
  });

  it("returns no findings without a warning for empty output", () => {
    const result = parseStrixOutput("   ");
    expect(result.findings).toEqual([]);
    expect(result.parseWarning).toBe(false);
  });
});

describe("collectStrixResults", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(path.join(tmpdir(), "strix-test-"));
  });

  afterEach(async () => {
    await rm(workspaceDir, { recursive: true, force: true });
  });

  it("prefers a result file under strix_runs/<run-name>/ over stdout", async () => {
    const runDir = path.join(workspaceDir, "strix_runs", "some-run-name");
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, "vulnerabilities.json"), JSON.stringify([{ title: "From file" }]));

    const result = await collectStrixResults("[]", workspaceDir);
    expect(result.findings).toEqual([{ title: "From file" }]);
    expect(result.source).toBe(path.join("strix_runs", "some-run-name", "vulnerabilities.json"));
  });

  it("falls back to stdout when no strix_runs directory exists", async () => {
    const result = await collectStrixResults(JSON.stringify([{ title: "From stdout" }]), workspaceDir);
    expect(result.findings).toEqual([{ title: "From stdout" }]);
    expect(result.source).toBe("stdout");
  });

  it("falls back to stdout when strix_runs exists but has no matching files", async () => {
    await mkdir(path.join(workspaceDir, "strix_runs", "empty-run"), { recursive: true });
    const result = await collectStrixResults(JSON.stringify([{ title: "From stdout" }]), workspaceDir);
    expect(result.source).toBe("stdout");
  });
});
