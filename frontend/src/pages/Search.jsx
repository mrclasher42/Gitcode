import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { UserAvatar } from "../components/UserAvatar";

export function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [input, setInput] = useState(q);
  const [data, setData] = useState({ users: [], repos: [], code: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q || q.length < 2) {
      setData({ users: [], repos: [], code: [] });
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [q]);

  function onSubmit(e) {
    e.preventDefault();
    const next = new URLSearchParams();
    next.set("q", input);
    setParams(next);
  }

  const total = data.users.length + data.repos.length + data.code.length;

  return (
    <div>
      <h1 className="mb-4 border-b border-[var(--color-border-muted)] pb-2 text-xl font-normal">
        Search
      </h1>

      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search users, repos..."
          autoFocus
          className="h-9 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
        />
        <button
          type="submit"
          className="h-9 rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-4 text-sm text-[var(--color-btn-primary-fg)]"
        >
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Searching...</p>
      ) : !q || q.length < 2 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">Type at least 2 characters.</p>
      ) : total === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">No results.</p>
      ) : (
        <div className="space-y-6">
          {data.users.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold">Users ({data.users.length})</h2>
              <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
                {data.users.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <UserAvatar user={u} size={32} />
                    <Link to={`/${u.username}`} className="font-semibold text-[var(--color-accent-fg)]">
                      {u.username}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.repos.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold">Repositories ({data.repos.length})</h2>
              <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
                {data.repos.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <Link to={`/${r.owner_username}/${r.name}`} className="font-semibold text-[var(--color-accent-fg)]">
                      {r.owner_username}/{r.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
