import type { RawStrixFinding } from "./strix-types";

interface ParsedStrixOutput {
  findings: RawStrixFinding[];
  parseWarning: boolean;
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
