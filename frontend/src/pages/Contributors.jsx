import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RepoTabs } from "../components/RepoTabs";

function avatarColor(name) {
  const colors = ["#0969da","#1a7f37","#bf3989","#8250df","#cf222e","#bc4c00","#0d9488","#6e40c9"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

export function Contributors() {
  const { owner, name } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/repos/${owner}/${name}/contributors`)
      .then((r) => r.json())
      .then((d) => setItems(d.contributors || []))
      .finally(() => setLoading(false));
  }, [owner, name]);

  return (
    <div>
      <h1 className="mb-4 border-b border-[var(--color-border-muted)] pb-2 text-xl font-normal">
        <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
          {owner}/{name}
        </Link>
        <span className="text-[var(--color-fg-muted)]"> / contributors</span>
      </h1>

      <RepoTabs />

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Loading...</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          No contributors yet.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
          {items.map((c, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: avatarColor(c.name) }}
              >
                {c.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-[var(--color-fg-muted)]">{c.email}</div>
              </div>
              <span className="text-xs text-[var(--color-fg-muted)]">
                {c.commits} {c.commits === 1 ? "commit" : "commits"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
