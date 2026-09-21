import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GitFork } from "lucide-react";
import { RepoTabs } from "../components/RepoTabs";

export function Forks() {
  const { owner, name } = useParams();
  const [forks, setForks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/repos/${owner}/${name}/forks`)
      .then((r) => r.json())
      .then((d) => setForks(d.forks || []))
      .finally(() => setLoading(false));
  }, [owner, name]);

  return (
    <div>
      <h1 className="mb-4 border-b border-[var(--color-border-muted)] pb-2 text-xl font-normal">
        <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
          {owner}/{name}
        </Link>
        <span className="text-[var(--color-fg-muted)]"> / forks</span>
      </h1>

      <RepoTabs />

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Loading...</p>
      ) : forks.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          No forks yet.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
          {forks.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <GitFork size={16} className="text-[var(--color-fg-muted)]" />
              <Link
                to={`/${f.owner_username}/${f.name}`}
                className="font-semibold text-[var(--color-accent-fg)]"
              >
                {f.owner_username}/{f.name}
              </Link>
              {f.description && (
                <span className="text-sm text-[var(--color-fg-muted)]">— {f.description}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
