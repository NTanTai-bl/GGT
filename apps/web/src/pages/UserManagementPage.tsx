import { useEffect, useMemo, useState, type FormEvent } from "react";
import { USER_ROLES, type UserRole } from "@pentest/shared";
import {
  api,
  type ManagedUser,
  type Project,
  type UserAuditLog,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<UserAuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(() => users.find((user) => user.id === selectedId) ?? null, [users, selectedId]);

  async function refresh(preferredId?: string) {
    const [nextUsers, nextProjects] = await Promise.all([api.listUsers(), api.listProjects()]);
    setUsers(nextUsers);
    setProjects(nextProjects);
    setSelectedId((current) => preferredId ?? current ?? nextUsers[0]?.id ?? null);
  }

  useEffect(() => {
    refresh().catch((err) => setError(messageOf(err)));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAuditLogs([]);
      return;
    }
    api.listUserAuditLogs(selectedId).then(setAuditLogs).catch((err) => setError(messageOf(err)));
  }, [selectedId, users]);

  async function run(action: () => Promise<unknown>, success: string, preferredId?: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      await refresh(preferredId);
      setNotice(success);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function runAndReload(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      window.location.reload();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2>User management</h2>
          <p>ADMIN-only account, role, project access and audit management.</p>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      <div className="grid user-admin-layout">
        <section>
          <h3>Accounts</h3>
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={user.id === selectedId ? "selected-row" : "clickable-row"}
                  onClick={() => setSelectedId(user.id)}
                >
                  <td><strong>{user.displayName}</strong><br /><span className="muted">{user.email}</span></td>
                  <td><span className="chip">{user.role}</span></td>
                  <td><span className={`chip ${user.isActive ? "COMPLETED" : "FAILED"}`}>{user.isActive ? "Active" : "Locked"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <CreateUserForm onCreate={(input) => run(async () => {
            const created = await api.createUser(input);
            setSelectedId(created.id);
          }, "Account created")}/>
        </section>

        <section>
          {selected ? (
            <UserEditor
              key={selected.id}
              user={selected}
              projects={projects}
              auditLogs={auditLogs}
              onSave={(input) => selected.id === currentUser?.id && input.role !== "ADMIN"
                ? runAndReload(() => api.updateUser(selected.id, input))
                : run(() => api.updateUser(selected.id, input), "Account updated", selected.id)}
              onToggle={() => selected.id === currentUser?.id && selected.isActive
                ? runAndReload(() => api.updateUser(selected.id, { isActive: false }))
                : run(
                    () => api.updateUser(selected.id, { isActive: !selected.isActive }),
                    selected.isActive ? "Account locked" : "Account unlocked",
                    selected.id
                  )}
              onResetPassword={(password) => selected.id === currentUser?.id
                ? runAndReload(() => api.resetUserPassword(selected.id, password))
                : run(
                    () => api.resetUserPassword(selected.id, password),
                    "Password reset; previous sessions have been invalidated",
                    selected.id
                  )}
              onAssign={(projectIds) => run(
                () => api.assignUserProjects(selected.id, projectIds),
                "Project access updated",
                selected.id
              )}
            />
          ) : <div className="card muted">Select an account.</div>}
        </section>
      </div>
    </div>
  );
}

function CreateUserForm({ onCreate }: { onCreate: (input: { email: string; displayName: string; role: UserRole; password: string }) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("VIEWER");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onCreate({ email, displayName, role, password });
    setEmail(""); setDisplayName(""); setPassword(""); setRole("VIEWER");
  }

  return (
    <div className="card admin-form-card">
      <h3>Create account</h3>
      <form onSubmit={submit}>
        <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Role<select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>{USER_ROLES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Temporary password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required /></label>
        <small className="muted">At least 12 characters with uppercase, lowercase and a number.</small>
        <button type="submit">Create account</button>
      </form>
    </div>
  );
}

function UserEditor({ user, projects, auditLogs, onSave, onToggle, onResetPassword, onAssign }: {
  user: ManagedUser;
  projects: Project[];
  auditLogs: UserAuditLog[];
  onSave: (input: { displayName: string; role: UserRole }) => Promise<void>;
  onToggle: () => Promise<void>;
  onResetPassword: (password: string) => Promise<void>;
  onAssign: (projectIds: string[]) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<UserRole>(user.role);
  const [password, setPassword] = useState("");
  const [projectIds, setProjectIds] = useState(() => user.memberships.map((membership) => membership.projectId));

  function toggleProject(projectId: string) {
    setProjectIds((current) => current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId]);
  }

  return (
    <div className="grid">
      <div className="card">
        <h3>{user.email}</h3>
        <form onSubmit={(event) => { event.preventDefault(); void onSave({ displayName, role }); }}>
          <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label>Role<select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>{USER_ROLES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <div className="button-row"><button type="submit">Save profile</button><button type="button" className="secondary" onClick={() => void onToggle()}>{user.isActive ? "Lock account" : "Unlock account"}</button></div>
        </form>
      </div>

      <div className="card">
        <h3>Reset password</h3>
        <form onSubmit={(event) => { event.preventDefault(); void onResetPassword(password).then(() => setPassword("")); }}>
          <label>New password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required /></label>
          <button type="submit">Reset password</button>
        </form>
      </div>

      <div className="card">
        <h3>Assigned projects</h3>
        <div className="project-checklist">
          {projects.map((project) => <label className="checkbox-row" key={project.id}><input type="checkbox" checked={projectIds.includes(project.id)} onChange={() => toggleProject(project.id)} /><span>{project.name}</span></label>)}
          {projects.length === 0 && <span className="muted">No projects available.</span>}
        </div>
        <button onClick={() => void onAssign(projectIds)}>Save project access</button>
      </div>

      <div className="card audit-card">
        <h3>Login and activity history</h3>
        <table><thead><tr><th>Time</th><th>Action</th><th>Performed by</th></tr></thead><tbody>
          {auditLogs.map((log) => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{log.action}</td><td>{log.actor?.email ?? "System/unknown"}</td></tr>)}
          {auditLogs.length === 0 && <tr><td colSpan={3} className="muted">No audit activity.</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}
