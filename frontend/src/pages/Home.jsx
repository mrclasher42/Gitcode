import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export function Home() {
  const { user } = useAuth();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listRepos()
      .then((d) => setRepos(d.repos || []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border-muted)] pb-2">
        <h1 className="text-xl font-normal">
          {user ? `Hello, ${user.username}` : "Explore GitCode"}
        </h1>
        {user && (
          <Link
            to="/new"
            className="rounded-md border border-[var(--color-btn-border)] bg-[var(--color-btn-primary-bg)] px-3 py-1 text-sm text-[var(--color-btn-primary-fg)]"
          >
            New repository
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Loading...</p>
      ) : repos.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          No repositories yet.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-muted)]">
          {repos.map((r) => (
            <li key={r.id} className="py-3">
              <Link
                to={`/${r.owner_username}/${r.name}`}
                className="font-semibold text-[var(--color-accent-fg)]"
              >
                {r.owner_username}/{r.name}
              </Link>
              {r.description && (
                <p className="text-sm text-[var(--color-fg-muted)]">{r.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
