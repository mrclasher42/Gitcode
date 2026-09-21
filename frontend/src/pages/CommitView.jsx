import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export function CommitView() {
  const { owner, name, sha } = useParams();
  const [diff, setDiff] = useState("");
  const [commit, setCommit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load diff
    fetch(`/api/repos/${owner}/${name}/diff?sha=${encodeURIComponent(sha)}`)
      .then((r) => r.json())
      .then((d) => setDiff(d.diff || ""));

    // Load commit metadata from commits list
    fetch(`/api/repos/${owner}/${name}/commits?limit=200`)
      .then((r) => r.json())
      .then((d) => {
        const c = (d.commits || []).find((x) => x.sha === sha || x.sha.startsWith(sha));
        if (c) setCommit(c);
      })
      .finally(() => setLoading(false));
  }, [owner, name, sha]);

  function renderDiffLine(line, i) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      return <div key={i} className="text-[var(--color-fg-muted)]">{line}</div>;
    }
    if (line.startsWith("@@")) {
      return <div key={i} className="text-[var(--color-accent-fg)]">{line}</div>;
    }
    if (line.startsWith("+")) {
      return <div key={i} className="bg-[var(--color-success-subtle)] text-[var(--color-success-fg)]">{line}</div>;
    }
    if (line.startsWith("-")) {
      return <div key={i} className="bg-[var(--color-danger-subtle)] text-[var(--color-danger-fg)]">{line}</div>;
    }
    if (line.startsWith("diff ")) {
      return <div key={i} className="mt-3 font-semibold">{line}</div>;
    }
    return <div key={i}>{line || " "}</div>;
  }

  return (
    <div>
      <div className="mb-4 border-b border-[var(--color-border-muted)] pb-3">
        <Link
          to={`/${owner}/${name}/commits`}
          className="text-sm text-[var(--color-accent-fg)]"
        >
          ← All commits
        </Link>
        <div className="mt-2">
          <h1 className="text-lg font-semibold">
            {commit ? commit.message : sha.slice(0, 7)}
          </h1>
          {commit && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--color-fg-muted)]">
              <span>
                {commit.author_name} &lt;{commit.author_email}&gt;
              </span>
              <span>{new Date(commit.timestamp * 1000).toLocaleString()}</span>
              <code className="rounded bg-[var(--color-canvas-subtle)] px-1.5 py-0.5 font-mono">
                {commit.sha}
              </code>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Loading diff...</p>
      ) : diff ? (
        <div className="overflow-hidden rounded-md border border-[var(--color-border-default)]">
          <pre className="no-scrollbar overflow-x-auto bg-[var(--color-canvas-default)] p-3 font-mono text-xs leading-relaxed">
            {diff.split("\n").map(renderDiffLine)}
          </pre>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-fg-muted)]">No diff available.</p>
      )}
    </div>
  );
}
