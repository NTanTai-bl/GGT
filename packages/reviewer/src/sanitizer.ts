const MAX_FIELD_CHARS = 8_000;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED_AWS_ACCESS_KEY]"],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_API_KEY]"],
  [/(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;"']+/gi, "$1[REDACTED]"],
  [/(cookie|set-cookie|password|client_secret|jwt_secret|private_key|api_key|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
];

export function sanitizeText(value: string, maxChars = MAX_FIELD_CHARS): string {
  let sanitized = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) sanitized = sanitized.replace(pattern, replacement);
  return sanitized.slice(0, maxChars);
}

const ALLOWED_FINDING_FIELDS = [
  "id", "title", "severity", "description", "impact", "target", "technical_analysis",
  "poc_description", "poc_script_code", "remediation_steps", "evidence", "assumptions",
  "counterevidence", "confidence", "confidence_rationale", "severity_change_conditions",
  "fix_effort", "cvss", "cvss_breakdown", "endpoint", "method", "cwe", "code_locations",
  "finding_class",
] as const;

export function sanitizeFinding(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of ALLOWED_FINDING_FIELDS) {
    if (!(field in source)) continue;
    result[field] = sanitizeValue(source[field], 0);
  }
  return result;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([key, nested]) => [key, sanitizeValue(nested, depth + 1)])
    );
  }
  return undefined;
}
