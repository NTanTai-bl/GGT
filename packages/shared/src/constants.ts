export const TARGET_TYPES = ["SOURCE", "WEB", "API"] as const;
export const ENVIRONMENTS = ["DEV", "STAGING", "PRODUCTION"] as const;
export const SCAN_MODES = ["QUICK", "STANDARD", "DEEP"] as const;
export const SCAN_TYPES = ["SOURCE_REVIEW", "BLACK_BOX", "AUTHENTICATED", "WHITE_BOX"] as const;
export const RUN_STATUSES = [
  "QUEUED",
  "PREPARING",
  "RUNNING",
  "PROCESSING_RESULTS",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
export const FINDING_STATUSES = [
  "OPEN",
  "CONFIRMED",
  "FIXING",
  "FIXED_PENDING_RETEST",
  "VERIFIED_FIXED",
  "FALSE_POSITIVE",
  "ACCEPTED_RISK",
] as const;
export const INTEGRATION_TYPES = ["JIRA", "SLACK"] as const;
export const USER_ROLES = ["ADMIN", "SECURITY", "DEVELOPER", "VIEWER"] as const;

export const PENTEST_REQUESTED_EVENT = "PENTEST_REQUESTED" as const;

/** Strix CLI exit code contract — see packages/strix/src/strix-client.ts.
 * ASSUMED per the GGT spec, not yet verified against a real `strix --help` /
 * real exit codes. Confirm against the installed version before relying on this. */
export const STRIX_EXIT_CODES = {
  NO_VULNERABILITIES: 0,
  EXECUTION_ERROR: 1,
  VULNERABILITIES_FOUND: 2,
} as const;

/**
 * The core target/credential validation matrix per scan type (spec §11).
 * `credential` is "required" | "optional" | "none". Enforced server-side —
 * see packages/shared/src/scan-type-rules.ts — never trust the frontend for this.
 */
export const SCAN_TYPE_REQUIREMENTS = {
  SOURCE_REVIEW: { needsSource: true, needsWebOrApi: false, credential: "none" },
  BLACK_BOX: { needsSource: false, needsWebOrApi: true, credential: "none" },
  AUTHENTICATED: { needsSource: false, needsWebOrApi: true, credential: "required" },
  WHITE_BOX: { needsSource: true, needsWebOrApi: true, credential: "optional" },
} as const;
