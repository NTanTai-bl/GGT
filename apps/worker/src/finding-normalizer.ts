import { createHash } from "node:crypto";
import { SEVERITIES, type Severity } from "@pentest/shared";
import type { RawStrixFinding } from "@pentest/strix";

export interface NormalizedFinding {
  fingerprint: string;
  title: string;
  severity: Severity;
  category: string;
  description: string;
  endpoint: string | null;
  method: string | null;
  evidence: string | null;
  poc: string | null;
  impact: string | null;
  recommendation: string | null;
}

/**
 * Converts whatever shape Strix emitted into our fixed internal schema.
 * Strix's own field names aren't a contract we control, so every field is
 * read defensively across a few plausible aliases instead of assuming one.
 */
export function normalizeFinding(raw: RawStrixFinding): NormalizedFinding {
  const title = firstString(raw, ["title", "name", "vulnerability", "summary"]) ?? "Untitled finding";
  const category = firstString(raw, ["category", "type", "vulnerability_type", "class"]) ?? "Uncategorized";
  const description = firstString(raw, ["description", "desc", "details"]) ?? "";
  const endpoint = firstString(raw, ["endpoint", "url", "path", "uri"]);
  const method = firstString(raw, ["method", "http_method", "verb"])?.toUpperCase() ?? null;
  const evidence = firstString(raw, ["evidence", "proof", "request_response"]);
  const poc = firstString(raw, ["poc", "proof_of_concept", "reproduction"]);
  const impact = firstString(raw, ["impact", "business_impact"]);
  const recommendation = firstString(raw, ["recommendation", "remediation", "fix"]);
  const severity = normalizeSeverity(firstString(raw, ["severity", "risk", "risk_level"]));

  const fingerprint = createHash("sha256")
    .update([title, category, endpoint ?? "", method ?? ""].join("|").toLowerCase())
    .digest("hex");

  return {
    fingerprint,
    title,
    severity,
    category,
    description,
    endpoint: endpoint ?? null,
    method,
    evidence: evidence ?? null,
    poc: poc ?? null,
    impact: impact ?? null,
    recommendation: recommendation ?? null,
  };
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

function normalizeSeverity(value: string | undefined): Severity {
  if (!value) return "INFO";
  const upper = value.toUpperCase().trim();
  if ((SEVERITIES as readonly string[]).includes(upper)) {
    return upper as Severity;
  }
  // Map common synonyms Strix (or its underlying LLM) might use.
  if (upper === "MODERATE") return "MEDIUM";
  if (upper === "MINOR") return "LOW";
  if (upper === "SEVERE" || upper === "URGENT") return "CRITICAL";
  return "INFO";
}
