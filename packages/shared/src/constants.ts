export const TARGET_TYPES = ["URL", "REPOSITORY"] as const;
export const ENVIRONMENTS = ["DEV", "STAGING", "PRODUCTION"] as const;
export const SCAN_MODES = ["QUICK", "STANDARD", "DEEP"] as const;
export const RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
export const FINDING_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "FIXED",
  "FALSE_POSITIVE",
] as const;
export const INTEGRATION_TYPES = ["JIRA", "SLACK"] as const;

export const PENTEST_REQUESTED_EVENT = "PENTEST_REQUESTED" as const;

/** Strix CLI exit code contract — see packages/strix/src/strix-client.ts */
export const STRIX_EXIT_CODES = {
  NO_VULNERABILITIES: 0,
  EXECUTION_ERROR: 1,
  VULNERABILITIES_FOUND: 2,
} as const;
