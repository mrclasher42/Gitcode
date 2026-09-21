import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { GitCommit } from "lucide-react";
import { RepoTabs } from "../components/RepoTabs";

export function Commits() {
  const { owner, name } = useParams();
  const [params, setParams] = useSearchParams();
  const branch = params.get("branch") || "main";
  const [branches, setBranches] = useState([]);
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/repos/${owner}/${name}/branches`)
      .then((r) => r.json())
      .then((d) => setBranches(d.branches || []));
  }, [owner, name]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/repos/${owner}/${name}/commits?branch=${encodeURIComponent(branch)}&limit=100`)
      .then((r) => r.json())
      .then((d) => setCommits(d.commits || []))
      .finally(() => setLoading(false));
  }, [owner, name, branch]);

  function changeBranch(b) {
    const next = new URLSearchParams(params);
    next.set("branch", b);
    setParams(next);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-muted)] pb-2">
        <h1 className="text-xl font-normal">
          <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
            {owner}/{name}
          </Link>
          <span className="text-[var(--color-fg-muted)]"> / commits</span>
        </h1>
        {branches.length > 0 && (
          <select
            value={branch}
            onChange={(e) => changeBranch(e.target.value)}
            className="h-8 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-2 text-sm"
          >
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      <RepoTabs />

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Loading...</p>
      ) : commits.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          No commits.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
          {commits.map((c) => (
            <li key={c.sha} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/${owner}/${name}/commit/${c.sha}`}
                    className="text-sm font-semibold text-[var(--color-accent-fg)] hover:underline"
                  >
                    {c.message}
                  </Link>
                  <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                    {c.author_name} &middot; {new Date(c.timestamp * 1000).toLocaleString()}
                  </div>
                </div>
                <Link
                  to={`/${owner}/${name}/commit/${c.sha}`}
                  className="shrink-0 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] px-2 py-0.5 font-mono text-xs hover:bg-[var(--color-btn-hover-bg)]"
                >
                  {c.sha.slice(0, 7)}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
