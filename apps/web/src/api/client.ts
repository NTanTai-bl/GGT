import type {
  Environment,
  FindingStatus,
  RunStatus,
  ScanMode,
  ScanType,
  Severity,
  TargetType,
  UserRole,
} from "@pentest/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
export const SESSION_EXPIRED_EVENT = "ggt:session-expired";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    // Session expired or was invalidated (password reset, account locked):
    // let AuthProvider drop back to the login screen instead of leaving every
    // page showing request errors.
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(res.status, body.error || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ id: string; email: string; displayName: string; role: UserRole }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ id: string; email: string; role: UserRole }>("/api/auth/me"),

  listUsers: () => request<ManagedUser[]>("/api/users"),
  createUser: (input: CreateUserInput) =>
    request<ManagedUser>("/api/users", { method: "POST", body: JSON.stringify(input) }),
  updateUser: (id: string, input: { displayName?: string; role?: UserRole; isActive?: boolean }) =>
    request<ManagedUser>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  resetUserPassword: (id: string, password: string) =>
    request<void>(`/api/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
  assignUserProjects: (id: string, projectIds: string[]) =>
    request<ManagedUser>(`/api/users/${id}/projects`, { method: "PUT", body: JSON.stringify({ projectIds }) }),
  listUserAuditLogs: (id: string) => request<UserAuditLog[]>(`/api/users/${id}/audit-logs`),

  listProjects: () => request<Project[]>("/api/projects"),
  getProject: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),
  createProject: (input: { name: string; description?: string }) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
  updateProjectMembers: (id: string, memberIds: string[]) =>
    request<ProjectDetail>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ memberIds }) }),

  listTargets: (projectId: string) => request<Target[]>(`/api/projects/${projectId}/targets`),
  createTarget: (projectId: string, input: CreateTargetInput) =>
    request<Target>(`/api/projects/${projectId}/targets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listPentests: () => request<PentestRun[]>("/api/pentests"),
  getPentest: (id: string) => request<PentestRun>(`/api/pentests/${id}`),
  createPentest: (input: CreatePentestInput) =>
    request<{ runId: string; status: RunStatus }>("/api/pentests", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancelPentest: (id: string) => request<PentestRun>(`/api/pentests/${id}/cancel`, { method: "POST" }),
  listFindings: (runId: string) => request<Finding[]>(`/api/pentests/${runId}/findings`),
  listRunEvents: (runId: string) => request<RunEvent[]>(`/api/pentests/${runId}/events`),
  listRunArtifacts: (runId: string) => request<RunArtifact[]>(`/api/pentests/${runId}/artifacts`),

  updateFinding: (id: string, input: { status: FindingStatus }) =>
    request<Finding>(`/api/findings/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
};

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMembership {
  id: string;
  projectId: string;
  userId: string;
  user?: { id: string; email: string; displayName: string };
}

export interface ManagedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memberships: Array<ProjectMembership & { project?: { id: string; name: string } }>;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  role: UserRole;
  password: string;
}

export interface UserAuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; email: string; displayName: string } | null;
}

export interface ProjectDetail extends Project {
  targets: Target[];
  memberships: ProjectMembership[];
}

export interface Target {
  id: string;
  projectId: string;
  type: TargetType;
  target: string;
  environment: Environment;
  branch: string | null;
  commitSha: string | null;
  authorizationConfirmed: boolean;
  createdAt: string;
}

export interface CreateTargetInput {
  type: TargetType;
  target: string;
  environment: Environment;
  branch?: string;
  commitSha?: string;
  authorizationConfirmed: true;
}

export interface PentestRun {
  id: string;
  projectId: string;
  targets?: Target[];
  status: RunStatus;
  scanType: ScanType;
  scanMode: ScanMode;
  instruction: string | null;
  credentialSecretArn: string | null;
  currentStage: string | null;
  strixRunId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface CreatePentestInput {
  projectId: string;
  scanType: ScanType;
  scanMode: ScanMode;
  targetIds: string[];
  instruction?: string;
  credentialSecretArn?: string;
  authorizationConfirmed: true;
}

export interface RunEvent {
  id: string;
  runId: string;
  event: string;
  message: string | null;
  createdAt: string;
}

export interface RunArtifact {
  key: string;
  filename: string;
  sizeBytes: number;
  lastModified: string | null;
  downloadUrl: string;
}

export interface Finding {
  id: string;
  runId: string;
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
  status: FindingStatus;
  jiraIssueKey: string | null;
  createdAt: string;
}
