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
 * Converts whatever shape Strix (or a SARIF result file it produced)
 * emitted into our fixed internal schema. Strix's own field names aren't a
 * contract we control, so every field is read defensively across a few
 * plausible aliases instead of assuming one.
 */
export function normalizeFinding(rawInput: RawStrixFinding): NormalizedFinding {
  // SARIF-derived fields fill gaps only — an explicit top-level field on
  // rawInput (non-SARIF Strix output) always wins if both are present.
  const raw = { ...extractSarifFields(rawInput), ...rawInput };

  const title = firstString(raw, ["title", "name", "vulnerability", "summary", "ruleId"]) ?? "Untitled finding";
  const category = firstString(raw, ["category", "type", "vulnerability_type", "class"]) ?? "Uncategorized";
  const cwe = firstString(raw, ["cwe", "cweId"]);
  const description = firstString(raw, ["description", "desc", "details"]) ?? "";
  const endpoint = firstString(raw, ["endpoint", "url", "path", "uri"]);
  const method = firstString(raw, ["method", "http_method", "verb"])?.toUpperCase() ?? null;
  const sourceFile = firstString(raw, ["sourceFile", "source_file"]);
  const sourceLine = firstNumber(raw, ["sourceLine", "source_line"]);
  const evidence = firstString(raw, ["evidence", "proof", "request_response"]);
  const poc = firstString(raw, ["poc", "proof_of_concept", "reproduction"]);
  const impact = firstString(raw, ["impact", "business_impact"]);
  const recommendation = firstString(raw, ["recommendation", "remediation", "fix"]);
  const severity = normalizeSeverity(firstString(raw, ["severity", "risk", "risk_level", "level"]));

  const fingerprint = createHash("sha256")
    .update([title, category, endpoint ?? "", method ?? "", sourceFile ?? "", String(sourceLine ?? "")].join("|").toLowerCase())
    .digest("hex");

  return {
    fingerprint,
    title,
    severity,
    category,
    cwe: cwe ?? null,
    description,
    endpoint: endpoint ?? null,
    method,
    sourceFile: sourceFile ?? null,
    sourceLine: sourceLine ?? null,
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
