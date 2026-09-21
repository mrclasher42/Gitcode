import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tag, Download, Trash2, Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { RepoTabs } from "../components/RepoTabs";
import { useToast } from "../components/Toast";

export function Releases() {
  const { owner, name } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);

  const canManage = user && user.username === owner;

  function load() {
    setLoading(true);
    fetch(`/api/repos/${owner}/${name}/releases`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setReleases(d.releases || []))
      .catch(() => setReleases([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [owner, name]);

  async function deleteRelease(id, tag) {
    if (!confirm(`Delete release "${tag}"?`)) return;
    try {
      const r = await fetch(`/api/repos/${owner}/${name}/releases/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      toast.success("Release deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <div>
      <div className="mb-4 border-b border-[var(--color-border-muted)] pb-2">
        <h1 className="text-xl font-normal">
          <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
            {owner}/{name}
          </Link>
          <span className="text-[var(--color-fg-muted)]"> / releases</span>
        </h1>
      </div>

      <RepoTabs />

      <div className="my-3 flex items-center justify-between">
        <p className="text-sm text-[var(--color-fg-muted)]">
          {releases.length} release{releases.length === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Link
            to={`/${owner}/${name}/releases/new`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm text-[var(--color-btn-primary-fg)]"
          >
            <Plus size={14} /> New release
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Loading...</p>
      ) : releases.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          No releases yet.
        </div>
      ) : (
        <ul className="space-y-4">
          {releases.map((rel) => (
            <li key={rel.id} className="rounded-md border border-[var(--color-border-default)]">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--color-border-muted)] bg-[var(--color-canvas-subtle)] px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag size={14} className="text-[var(--color-accent-fg)]" />
                    <span className="font-semibold">{rel.name}</span>
                    <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-2 py-0.5 font-mono text-xs">
                      {rel.tag}
                    </span>
                    {rel.is_prerelease ? (
                      <span className="rounded-full border border-[var(--color-attention-fg)] px-2 py-0.5 text-xs text-[var(--color-attention-fg)]">
                        Pre-release
                      </span>
                    ) : (
                      <span className="rounded-full border border-[var(--color-success-emphasis)] px-2 py-0.5 text-xs text-[var(--color-success-fg)]">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                    {rel.author_username} released this on{" "}
                    {new Date(rel.created_at * 1000).toLocaleDateString()}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => deleteRelease(rel.id, rel.tag)}
                    className="shrink-0 rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] p-1.5 text-[var(--color-danger-fg)] hover:bg-[var(--color-btn-hover-bg)]"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {rel.body && (
                <div className="whitespace-pre-wrap border-b border-[var(--color-border-muted)] px-4 py-3 text-sm">
                  {rel.body}
                </div>
              )}

              {rel.assets && rel.assets.length > 0 && (
                <div className="px-4 py-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
                    Assets
                  </h3>
                  <ul className="space-y-1">
                    {rel.assets.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <Download size={14} className="text-[var(--color-fg-muted)]" />
                        <a
                          href={`/api/repos/${owner}/${name}/releases/assets/${a.id}/download`}
                          className="text-[var(--color-accent-fg)] hover:underline"
                          download
                        >
                          {a.filename}
                        </a>
                        <span className="text-xs text-[var(--color-fg-muted)]">
                          {formatSize(a.size)} · {a.downloads} downloads
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canManage && (
                <div className="border-t border-[var(--color-border-muted)] px-4 py-2">
                  <Link
                    to={`/${owner}/${name}/releases/${rel.id}`}
                    className="text-xs text-[var(--color-accent-fg)]"
                  >
                    Upload assets →
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
