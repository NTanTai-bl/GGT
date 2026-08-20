import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Finding, type PentestRun, type Project } from "../api/client";

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

  const runningCount = runs.filter((r) => r.status === "QUEUED" || r.status === "RUNNING").length;
  const recentRuns = runs.slice(0, 8);

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="grid cols-4" style={{ marginBottom: 28 }}>
        <Stat label="Projects" value={projects.length} />
        <Stat label="Running pentests" value={runningCount} />
        <Stat label="Critical findings" value={severityCounts.CRITICAL ?? 0} accent="var(--crit)" />
        <Stat label="High findings" value={severityCounts.HIGH ?? 0} accent="var(--high)" />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: -18 }}>
        Finding counts are based on the 5 most recently completed runs.
      </p>

      <h2>Recent runs</h2>
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
              <th>Scan mode</th>
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
