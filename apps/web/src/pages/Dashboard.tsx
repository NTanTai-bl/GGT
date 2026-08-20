import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Finding, type PentestRun, type Project } from "../api/client";

const ACTIVE_STATUSES = ["QUEUED", "PREPARING", "RUNNING", "PROCESSING_RESULTS"];

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<PentestRun[]>([]);
  const [severityCounts, setSeverityCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [projectList, runList] = await Promise.all([api.listProjects(), api.listPentests()]);
      setProjects(projectList);
      setRuns(runList);

      const recentCompleted = runList.filter((r) => r.status === "COMPLETED").slice(0, 5);
      const findingsPerRun = await Promise.all(
        recentCompleted.map((r) => api.listFindings(r.id).catch(() => [] as Finding[]))
      );
      const counts: Record<string, number> = {};
      for (const findings of findingsPerRun) {
        for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
      }
      setSeverityCounts(counts);
      setLoading(false);
    })();
  }, []);

  const runningCount = runs.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;
  const completedCount = runs.filter((r) => r.status === "COMPLETED").length;
  const failedCount = runs.filter((r) => r.status === "FAILED").length;
  const recentRuns = runs.slice(0, 8);

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Projects" value={projects.length} />
        <Stat label="Running pentests" value={runningCount} />
        <Stat label="Completed pentests" value={completedCount} />
        <Stat label="Failed pentests" value={failedCount} accent="var(--crit)" />
      </div>
      <div className="grid cols-4" style={{ marginBottom: 28 }}>
        <Stat label="Critical findings" value={severityCounts.CRITICAL ?? 0} accent="var(--crit)" />
        <Stat label="High findings" value={severityCounts.HIGH ?? 0} accent="var(--high)" />
        <Stat label="Medium findings" value={severityCounts.MEDIUM ?? 0} accent="var(--med)" />
        <Stat label="Low findings" value={severityCounts.LOW ?? 0} accent="var(--low)" />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: -18 }}>
        Finding counts are based on the 5 most recently completed runs.
      </p>

      <h2>Recent Pentest Runs</h2>
      {loading ? (
        <p>Loading...</p>
      ) : recentRuns.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No pentests have been run yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Started</th>
              <th>Status</th>
              <th>Scan type</th>
              <th>Depth</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.map((run) => (
              <tr key={run.id}>
                <td>{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</td>
                <td>
                  <span className={`chip ${run.status}`}>{run.status}</span>
                </td>
                <td>{run.scanType}</td>
                <td>{run.scanMode}</td>
                <td>
                  <Link to={`/pentests/${run.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card">
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
