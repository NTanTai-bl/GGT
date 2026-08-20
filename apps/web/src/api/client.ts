const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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
    throw new ApiError(res.status, body.error || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ id: string; email: string; displayName: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ id: string; email: string }>("/api/auth/me"),

  listProjects: () => request<Project[]>("/api/projects"),
  getProject: (id: string) => request<Project & { targets: Target[] }>(`/api/projects/${id}`),
  createProject: (input: { name: string; description?: string }) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),

  listTargets: (projectId: string) => request<Target[]>(`/api/projects/${projectId}/targets`),
  createTarget: (projectId: string, input: CreateTargetInput) =>
    request<Target>(`/api/projects/${projectId}/targets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listPentests: () => request<PentestRun[]>("/api/pentests"),
  getPentest: (id: string) => request<PentestRun>(`/api/pentests/${id}`),
  createPentest: (input: CreatePentestInput) =>
    request<PentestRun>("/api/pentests", { method: "POST", body: JSON.stringify(input) }),
  cancelPentest: (id: string) => request<PentestRun>(`/api/pentests/${id}/cancel`, { method: "POST" }),
  listFindings: (runId: string) => request<Finding[]>(`/api/pentests/${runId}/findings`),

  updateFinding: (id: string, input: { status: string }) =>
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

export interface Target {
  id: string;
  projectId: string;
  type: "URL" | "REPOSITORY";
  target: string;
  environment: "DEV" | "STAGING" | "PRODUCTION";
  authorizationConfirmed: boolean;
  createdAt: string;
}

export interface CreateTargetInput {
  type: "URL" | "REPOSITORY";
  target: string;
  environment: "DEV" | "STAGING" | "PRODUCTION";
  authorizationConfirmed: true;
}

export interface PentestRun {
  id: string;
  projectId: string;
  targetId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  scanMode: "QUICK" | "STANDARD" | "DEEP";
  instruction: string | null;
  strixRunId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface CreatePentestInput {
  projectId: string;
  targetId: string;
  scanMode: "QUICK" | "STANDARD" | "DEEP";
  instruction?: string;
}

export interface Finding {
  id: string;
  runId: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: string;
  description: string;
  endpoint: string | null;
  method: string | null;
  evidence: string | null;
  poc: string | null;
  impact: string | null;
  recommendation: string | null;
  status: "OPEN" | "ACKNOWLEDGED" | "FIXED" | "FALSE_POSITIVE";
  jiraIssueKey: string | null;
  createdAt: string;
}
