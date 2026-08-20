import {
  ENVIRONMENTS,
  FINDING_STATUSES,
  INTEGRATION_TYPES,
  RUN_STATUSES,
  SCAN_MODES,
  SEVERITIES,
  TARGET_TYPES,
} from "./constants";

export type TargetType = (typeof TARGET_TYPES)[number];
export type Environment = (typeof ENVIRONMENTS)[number];
export type ScanMode = (typeof SCAN_MODES)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

/** Message published to SQS when a pentest is requested. */
export interface PentestRequestedMessage {
  eventType: "PENTEST_REQUESTED";
  runId: string;
  projectId: string;
  targetId: string;
  target: string;
  scanMode: ScanMode;
  instruction?: string | undefined;
}

export interface PentestFindingDTO {
  id: string;
  runId: string;
  title: string;
  severity: Severity;
  category: string;
  description: string;
  endpoint?: string | null;
  method?: string | null;
  evidence?: string | null;
  poc?: string | null;
  impact?: string | null;
  recommendation?: string | null;
  status: FindingStatus;
  jiraIssueKey?: string | null;
  createdAt: string;
  updatedAt: string;
}
