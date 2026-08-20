import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RawStrixFinding } from "./strix-types";

export interface ParsedStrixOutput {
  findings: RawStrixFinding[];
  parseWarning: boolean;
  /** Where the findings actually came from — useful when debugging a parseWarning. */
  source?: string;
}

/**
 * Spec §15: "do not rely exclusively on stdout... prefer structured
 * artifacts such as run.json, vulnerabilities.json, SARIF if present."
 * These exact filenames are still ASSUMED. What IS confirmed (from a real
 * `strix --help`'s `--resume RUN_NAME` description: "the dir under
 * ./strix_runs/") is that Strix writes a `./strix_runs/<run-name>/`
 * directory relative to its cwd — `strix-engine.ts` sets that cwd to the
 * run's workspace, and `resolveSearchDirs` below searches inside it.
 */
const RESULT_FILE_CANDIDATES = ["run.json", "vulnerabilities.json", "results.json"];
const SARIF_FILE_CANDIDATES = ["findings.sarif", "results.sarif"];

/**
 * Preferred entry point: look for structured result files in the run's
 * workspace directory first, and only fall back to scraping stdout if
 * none are found or none parse.
 */
export async function collectStrixResults(
  stdout: string,
  workspaceDir?: string
): Promise<ParsedStrixOutput> {
  if (workspaceDir) {
    const fromFiles = await tryParseResultFiles(workspaceDir);
    if (fromFiles) return fromFiles;
  }
  return { ...parseStrixOutput(stdout), source: "stdout" };
}

/**
 * Confirmed: Strix writes `./strix_runs/<run-name>/`. Unconfirmed: the
 * run-name subdirectory's own contents, so this searches — in order —
 * every subdirectory of strix_runs/, then strix_runs/ itself, then the
 * workspace root (in case that assumption is wrong too).
 */
async function resolveSearchDirs(workspaceDir: string): Promise<string[]> {
  const strixRunsDir = path.join(workspaceDir, "strix_runs");
  const dirs: string[] = [];
  try {
    const entries = await readdir(strixRunsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) dirs.push(path.join(strixRunsDir, entry.name));
    }
    dirs.push(strixRunsDir);
  } catch {
    // no strix_runs directory (yet, or the cwd assumption is wrong) — fall through
  }
  dirs.push(workspaceDir);
  return dirs;
}

async function tryParseResultFiles(workspaceDir: string): Promise<ParsedStrixOutput | null> {
  const searchDirs = await resolveSearchDirs(workspaceDir);
  for (const dir of searchDirs) {
    for (const filename of RESULT_FILE_CANDIDATES) {
      const parsed = await tryReadAndParseJsonFile(path.join(dir, filename));
      if (parsed) return { ...parsed, source: path.relative(workspaceDir, path.join(dir, filename)) };
    }
    for (const filename of SARIF_FILE_CANDIDATES) {
      const parsed = await tryReadAndParseSarifFile(path.join(dir, filename));
      if (parsed) return { ...parsed, source: path.relative(workspaceDir, path.join(dir, filename)) };
    }
  }
  return null;
}

async function tryReadAndParseJsonFile(filePath: string): Promise<ParsedStrixOutput | null> {
  try {
    const content = await readFile(filePath, "utf8");
    return tryParseJson(content);
  } catch {
    return null; // file doesn't exist or isn't readable — try the next candidate
  }
}

async function tryReadAndParseSarifFile(filePath: string): Promise<ParsedStrixOutput | null> {
  try {
    const content = await readFile(filePath, "utf8");
    const sarif: unknown = JSON.parse(content);
    return normalizeSarif(sarif);
  } catch {
    return null;
  }
}

/** SARIF is a stable external standard (unlike Strix's own JSON), so this mapping is load-bearing, not a guess. */
function normalizeSarif(sarif: unknown): ParsedStrixOutput | null {
  if (!sarif || typeof sarif !== "object") return null;
  const runs = (sarif as Record<string, unknown>).runs;
  if (!Array.isArray(runs)) return null;

  const findings: RawStrixFinding[] = [];
  for (const run of runs) {
    if (!run || typeof run !== "object") continue;
    const results = (run as Record<string, unknown>).results;
    if (!Array.isArray(results)) continue;
    for (const result of results) {
      if (!result || typeof result !== "object") continue;
      findings.push(result as RawStrixFinding);
    }
  }
  return { findings, parseWarning: false };
}

/**
 * Strix's stdout schema is not a stable contract we control, so this parser
 * tries a few known-reasonable shapes before giving up. When nothing parses,
 * it returns no findings rather than throwing — the raw stdout is always
 * kept as an artifact (see worker/src/artifact-store.ts) so nothing is lost.
 */
export function parseStrixOutput(stdout: string): ParsedStrixOutput {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { findings: [], parseWarning: false };
  }

  const wholeOutput = tryParseJson(trimmed);
  if (wholeOutput) return wholeOutput;

  const fenced = extractFencedJsonBlocks(trimmed);
  for (const block of fenced) {
    const parsed = tryParseJson(block);
    if (parsed) return parsed;
  }

  const jsonLines = extractJsonLines(trimmed);
  if (jsonLines.length > 0) {
    return { findings: jsonLines, parseWarning: false };
  }

  const largestJsonSpan = extractLargestJsonSpan(trimmed);
  if (largestJsonSpan) {
    const parsed = tryParseJson(largestJsonSpan);
    if (parsed) return parsed;
  }

  return { findings: [], parseWarning: true };
}

function tryParseJson(text: string): ParsedStrixOutput | null {
  try {
    const value: unknown = JSON.parse(text);
    return normalizeParsedValue(value);
  } catch {
    return null;
  }
}

function normalizeParsedValue(value: unknown): ParsedStrixOutput | null {
  if (Array.isArray(value)) {
    return { findings: value as RawStrixFinding[], parseWarning: false };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.findings)) {
      return { findings: record.findings as RawStrixFinding[], parseWarning: false };
    }
    if (Array.isArray(record.vulnerabilities)) {
      return { findings: record.vulnerabilities as RawStrixFinding[], parseWarning: false };
    }
  }
  return null;
}

function extractFencedJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const captured = match[1];
    if (captured) blocks.push(captured.trim());
  }
  return blocks;
}

/** Handles line-delimited JSON, one finding object per line. */
function extractJsonLines(text: string): RawStrixFinding[] {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const findings: RawStrixFinding[] = [];
  for (const line of lines) {
    if (!line.startsWith("{") || !line.endsWith("}")) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        findings.push(value as RawStrixFinding);
      }
    } catch {
      // not a JSON line — ignore, it's probably a log line
    }
  }
  return findings;
}

/** Last resort: the widest balanced [...] or {...} span in the text. */
function extractLargestJsonSpan(text: string): string | null {
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return text.slice(arrayStart, arrayEnd + 1);
  }
  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    return text.slice(objStart, objEnd + 1);
  }
  return null;
}
