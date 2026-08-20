import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { Environment, TargetType } from "@pentest/shared";
import { api, type PentestRun, type ProjectDetail } from "../api/client";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [runs, setRuns] = useState<PentestRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!id) return;
    const [p, allRuns] = await Promise.all([api.getProject(id), api.listPentests()]);
    setProject(p);
    setRuns(allRuns.filter((r) => r.projectId === id).slice(0, 10));
  }

  useEffect(() => {
    refresh();
  }, [id]);

  if (!project) return <p>Loading...</p>;

  return (
    <div>
      <h2>{project.name}</h2>
      {project.description && <p style={{ color: "var(--muted)" }}>{project.description}</p>}

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <div>
          <h3>Targets</h3>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Target</th>
                <th>Env</th>
                <th>Authorized</th>
              </tr>
            </thead>
            <tbody>
              {project.targets.map((t) => (
                <tr key={t.id}>
                  <td>{t.type}</td>
                  <td>
                    {t.target}
                    {t.branch && <span style={{ color: "var(--muted)" }}> @{t.branch}</span>}
                  </td>
                  <td>{t.environment}</td>
                  <td>{t.authorizationConfirmed ? "Yes" : "No"}</td>
                </tr>
              ))}
              {project.targets.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "var(--muted)" }}>
                    No targets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h3>Members</h3>
          <ul style={{ paddingLeft: 18, fontSize: 14 }}>
            {project.memberships.map((m) => (
              <li key={m.id}>{m.user?.email ?? m.userId}</li>
            ))}
            {project.memberships.length === 0 && <li style={{ color: "var(--muted)" }}>No members yet.</li>}
          </ul>

          <h3>Recent runs</h3>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Scan type</th>
                <th>Depth</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={`chip ${r.status}`}>{r.status}</span>
                  </td>
                  <td>{r.scanType}</td>
                  <td>{r.scanMode}</td>
                  <td>
                    <Link to={`/pentests/${r.id}`}>View</Link>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "var(--muted)" }}>
                    No runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Link to={`/pentests/new?projectId=${project.id}`}>
            <button style={{ marginTop: 12 }}>Start pentest</button>
          </Link>
        </div>

        <AddTargetForm projectId={project.id} onCreated={refresh} error={error} setError={setError} />
      </div>
    </div>
  );
}

function AddTargetForm({
  projectId,
  onCreated,
  error,
  setError,
}: {
  projectId: string;
  onCreated: () => void;
  error: string | null;
  setError: (e: string | null) => void;
}) {
  const [type, setType] = useState<TargetType>("WEB");
  const [target, setTarget] = useState("");
  const [branch, setBranch] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [environment, setEnvironment] = useState<Environment>("STAGING");
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!authorized) {
      setError("You must confirm this target is owned by the company or explicitly authorized for security testing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createTarget(projectId, {
        type,
        target,
        environment,
        branch: type === "SOURCE" ? branch || undefined : undefined,
        commitSha: type === "SOURCE" ? commitSha || undefined : undefined,
        authorizationConfirmed: true,
      });
      setTarget("");
      setBranch("");
      setCommitSha("");
      setAuthorized(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add target");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Add target</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as TargetType)}>
            <option value="SOURCE">Source</option>
            <option value="WEB">Web</option>
            <option value="API">API</option>
          </select>
        </label>
        <label>
          {type === "SOURCE" ? "Source (s3://bucket/key.tar.gz)" : `${type} target URL`}
          <input value={target} onChange={(e) => setTarget(e.target.value)} required />
        </label>
        {type === "SOURCE" && (
          <>
            <label>
              Branch (optional)
              <input value={branch} onChange={(e) => setBranch(e.target.value)} />
            </label>
            <label>
              Commit SHA (optional)
              <input value={commitSha} onChange={(e) => setCommitSha(e.target.value)} />
            </label>
          </>
        )}
        <label>
          Environment
          <select value={environment} onChange={(e) => setEnvironment(e.target.value as Environment)}>
            <option value="DEV">Dev</option>
            <option value="STAGING">Staging</option>
            <option value="PRODUCTION">Production</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
          <span>I confirm this target is owned by the company or explicitly authorized for security testing.</span>
        </label>
        <button type="submit" disabled={submitting || !authorized}>
          {submitting ? "Adding..." : "Add target"}
        </button>
      </form>
    </div>
  );
}
