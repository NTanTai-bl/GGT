import { createHash } from "node:crypto";
import { SEVERITIES, type Severity } from "@pentest/shared";
import type { RawStrixFinding } from "@pentest/strix";

export interface NormalizedFinding {
  fingerprint: string;
  title: string;
  severity: Severity;
  category: string;
  cwe: string | null;
  description: string;
  endpoint: string | null;
  method: string | null;
  sourceFile: string | null;
  sourceLine: number | null;
  evidence: string | null;
  poc: string | null;
  impact: string | null;
  recommendation: string | null;
}

/**
 * Column sizes of pentest_findings (packages/database migrations). LLM output
 * has no length contract, and one over-long value would make the INSERT fail
 * and silently drop the finding, so bounded columns are truncated here.
 */
const COLUMN_LIMITS = {
  title: 500,
  category: 200,
  cwe: 20,
  endpoint: 500,
  method: 10,
  sourceFile: 500,
} as const;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function truncateOrNull(value: string | undefined, max: number): string | null {
  return value === undefined ? null : truncate(value, max);
}

/**
 * Converts whatever shape Strix (or a SARIF result file it produced)
 * emitted into our fixed internal schema. Strix's own field names aren't a
 * contract we control, so every field is read defensively across a few
 * plausible aliases instead of assuming one.
 */
export function normalizeFinding(rawInput: RawStrixFinding): NormalizedFinding {
  // SARIF-derived fields fill gaps only — an explicit top-level field on
  // rawInput (non-SARIF Strix output) always wins if both are present.
  const raw = { ...extractSarifFields(rawInput), ...rawInput };

  const title = truncate(
    firstString(raw, ["title", "name", "vulnerability", "summary", "ruleId"]) ?? "Untitled finding",
    COLUMN_LIMITS.title
  );
  const category = truncate(
    firstString(raw, ["category", "type", "vulnerability_type", "finding_class", "class"]) ?? "Uncategorized",
    COLUMN_LIMITS.category
  );
  const cwe = truncateOrNull(firstString(raw, ["cwe", "cweId"]), COLUMN_LIMITS.cwe);
  const description = firstString(raw, ["description", "desc", "details"]) ?? "";
  const endpoint = truncateOrNull(firstString(raw, ["endpoint", "url", "path", "uri", "target"]), COLUMN_LIMITS.endpoint);
  const method = truncateOrNull(firstString(raw, ["method", "http_method", "verb"])?.toUpperCase(), COLUMN_LIMITS.method);
  const codeLocation = firstCodeLocation(raw);
  const sourceFile = truncateOrNull(
    firstString(raw, ["sourceFile", "source_file"]) ?? codeLocation.file,
    COLUMN_LIMITS.sourceFile
  );
  const sourceLine = firstNumber(raw, ["sourceLine", "source_line"]) ?? codeLocation.line;
  const evidence = firstString(raw, ["evidence", "proof", "request_response", "technical_analysis"]);
  const poc = firstString(raw, ["poc", "proof_of_concept", "reproduction", "poc_description", "poc_script_code"]);
  const impact = firstString(raw, ["impact", "business_impact"]);
  const recommendation = firstString(raw, ["recommendation", "remediation", "remediation_steps", "fix"]);
  const severity = normalizeSeverity(firstString(raw, ["severity", "risk", "risk_level", "level"]));

  const fingerprint = createHash("sha256")
    .update([title, category, endpoint ?? "", method ?? "", sourceFile ?? "", String(sourceLine ?? "")].join("|").toLowerCase())
    .digest("hex");

  return {
    fingerprint,
    title,
    severity,
    category,
    cwe,
    description,
    endpoint,
    method,
    sourceFile,
    sourceLine: sourceLine !== undefined && sourceLine > 0 ? Math.trunc(sourceLine) : null,
    evidence: evidence ?? null,
    poc: poc ?? null,
    impact: impact ?? null,
    recommendation: recommendation ?? null,
  };
}

/**
 * SARIF nests description/location/CWE under `message.text`,
 * `locations[0].physicalLocation`, and `properties.tags`. Lift those into
 * flat keys the alias-based extraction above already understands, without
 * clobbering a field Strix's own (non-SARIF) output already set directly.
 */
function extractSarifFields(raw: RawStrixFinding): Partial<RawStrixFinding> {
  const out: Record<string, unknown> = {};

  const message = asRecord(raw.message);
  if (message && typeof message.text === "string") {
    out.description = message.text;
  }

  const locations = raw.locations;
  const firstLocation = Array.isArray(locations) ? asRecord(locations[0]) : undefined;
  const physical = firstLocation ? asRecord(firstLocation.physicalLocation) : undefined;
  const artifactLocation = physical ? asRecord(physical.artifactLocation) : undefined;
  const region = physical ? asRecord(physical.region) : undefined;
  if (artifactLocation && typeof artifactLocation.uri === "string") {
    out.sourceFile = artifactLocation.uri;
  }
  if (region && typeof region.startLine === "number") {
    out.sourceLine = region.startLine;
  }

  const properties = asRecord(raw.properties);
  const tags = properties?.tags;
  if (Array.isArray(tags)) {
    const cweTag = tags.find((tag) => typeof tag === "string" && /^CWE-\d+$/i.test(tag));
    if (cweTag) out.cwe = cweTag;
  }

  return out;
}

/**
 * Strix's own vulnerability reports carry `code_locations: [{ file, start_line }]`
 * (the same field the AI reviewer reads) instead of flat sourceFile/sourceLine.
 */
function firstCodeLocation(raw: RawStrixFinding): { file?: string; line?: number } {
  const locations = raw.code_locations;
  const first = Array.isArray(locations) ? asRecord(locations[0]) : undefined;
  if (!first) return {};
  const file = typeof first.file === "string" && first.file.trim() ? first.file.trim() : undefined;
  const lineValue = first.start_line ?? first.line ?? first.startLine;
  const line = typeof lineValue === "number" && Number.isInteger(lineValue) ? lineValue : undefined;
  return { file, line };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function firstString(raw: RawStrixFinding, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function firstNumber(raw: RawStrixFinding, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function normalizeSeverity(value: string | undefined): Severity {
  if (!value) return "INFO";
  const upper = value.toUpperCase().trim();
  if ((SEVERITIES as readonly string[]).includes(upper)) {
    return upper as Severity;
  }
  // Map common synonyms Strix (or its underlying LLM) might use, plus SARIF's own `level` values.
  if (upper === "MODERATE") return "MEDIUM";
  if (upper === "MINOR") return "LOW";
  if (upper === "SEVERE" || upper === "URGENT") return "CRITICAL";
  if (upper === "ERROR") return "HIGH";
  if (upper === "WARNING") return "MEDIUM";
  if (upper === "NOTE") return "LOW";
  return "INFO";
}
