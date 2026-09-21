import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { RepoTabs } from "../components/RepoTabs";

export function RepoSearch() {
  const { owner, name } = useParams();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [input, setInput] = useState(q);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError("");
    fetch(`/api/repos/${owner}/${name}/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setResults(d.results || []);
      })
      .catch((e) => setError(e.message || "Search failed"))
      .finally(() => setLoading(false));
  }, [owner, name, q]);

  function onSubmit(e) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    next.set("q", input);
    setParams(next);
  }

  return (
    <div>
      <h1 className="mb-4 border-b border-[var(--color-border-muted)] pb-2 text-xl font-normal">
        Search in{" "}
        <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
          {owner}/{name}
        </Link>
      </h1>

      <RepoTabs />

      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search code..."
          autoFocus
          className="h-8 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
        />
        <button
          type="submit"
          className="h-8 rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm text-[var(--color-btn-primary-fg)]"
        >
          Search
        </button>
      </form>

      {loading && <p className="text-[var(--color-fg-muted)]">Searching...</p>}
      {error && (
        <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
          {error}
        </div>
      )}

      {!loading && q && results.length === 0 && !error && (
        <p className="text-sm text-[var(--color-fg-muted)]">No results.</p>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
          {results.map((r, i) => (
            <li key={i} className="px-3 py-2 text-sm">
              <Link
                to={`/${owner}/${name}/blob/${params.get("branch") || "main"}/${r.path}`}
                className="font-mono text-[var(--color-accent-fg)]"
              >
                {r.path}:{r.line}
              </Link>
              <pre className="mt-1 no-scrollbar overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--color-fg-muted)]">
                {r.text}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
