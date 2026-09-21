import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CircleDot, CheckCircle2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/cn";
import { RepoTabs } from "../components/RepoTabs";

export function Issues() {
  const { owner, name } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const state = params.get("state") || "open";
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/repos/${owner}/${name}/issues?state=${state}`)
      .then((r) => r.json())
      .then((d) => setIssues(d.issues || []))
      .finally(() => setLoading(false));
  }, [owner, name, state]);

  function changeState(s) {
    const next = new URLSearchParams(params);
    next.set("state", s);
    setParams(next);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-muted)] pb-2">
        <h1 className="text-xl font-normal">
          <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
            {owner}/{name}
          </Link>
          <span className="text-[var(--color-fg-muted)]"> / issues</span>
        </h1>
        {user && (
          <Link
            to={`/${owner}/${name}/issues/new`}
            className="inline-flex h-8 items-center rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm text-[var(--color-btn-primary-fg)] hover:bg-[var(--color-btn-primary-hover-bg)]"
          >
            New issue
          </Link>
        )}
      </div>

      <RepoTabs />

      <div className="mb-3 flex gap-1 border-b border-[var(--color-border-muted)]">
        <button
          onClick={() => changeState("open")}
          className={cn(
            "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm",
            state === "open"
              ? "border-[var(--color-accent-fg)] font-semibold text-[var(--color-fg-default)]"
              : "border-transparent text-[var(--color-fg-muted)]"
          )}
        >
          <CircleDot size={14} />
          Open
        </button>
        <button
          onClick={() => changeState("closed")}
          className={cn(
            "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm",
            state === "closed"
              ? "border-[var(--color-accent-fg)] font-semibold text-[var(--color-fg-default)]"
              : "border-transparent text-[var(--color-fg-muted)]"
          )}
        >
          <CheckCircle2 size={14} />
          Closed
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Loading...</p>
      ) : issues.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          No {state} issues.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
          {issues.map((i) => (
            <li key={i.id} className="flex items-start gap-3 px-4 py-3">
              {i.state === "open" ? (
                <CircleDot size={16} className="mt-0.5 text-[var(--color-success-fg)]" />
              ) : (
                <CheckCircle2 size={16} className="mt-0.5 text-[var(--color-done)]" />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  to={`/${owner}/${name}/issues/${i.number}`}
                  className="font-semibold text-[var(--color-accent-fg)] hover:underline"
                >
                  {i.title}
                </Link>
                <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                  #{i.number} opened by {i.author_username} &middot;{" "}
                  {new Date(i.created_at * 1000).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
