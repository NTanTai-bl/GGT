import {
  ENVIRONMENTS,
  FINDING_STATUSES,
  INTEGRATION_TYPES,
  RUN_STATUSES,
  SCAN_MODES,
  SCAN_TYPES,
  SEVERITIES,
  TARGET_TYPES,
  USER_ROLES,
} from "./constants";

export type TargetType = (typeof TARGET_TYPES)[number];
export type Environment = (typeof ENVIRONMENTS)[number];
export type ScanMode = (typeof SCAN_MODES)[number];
export type ScanType = (typeof SCAN_TYPES)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Message published to SQS when a pentest is requested. Deliberately just
 * an identifier — SQS is job delivery, not a results channel (spec §12).
 * The worker loads everything else fresh from RDS by runId.
 */
export interface PentestRequestedMessage {
  eventType: "PENTEST_REQUESTED";
  runId: string;
}

export interface PentestFindingDTO {
  id: string;
  runId: string;
  title: string;
  severity: Severity;
  category: string;
  cwe?: string | null;
  description: string;
  endpoint?: string | null;
  method?: string | null;
  sourceFile?: string | null;
  sourceLine?: number | null;
  evidence?: string | null;
  poc?: string | null;
  impact?: string | null;
  recommendation?: string | null;
  status: FindingStatus;
  jiraIssueKey?: string | null;
  createdAt: string;
  updatedAt: string;
}
