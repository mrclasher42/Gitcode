import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tag, Upload, Download } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/Toast";

export function ReleaseView() {
  const { owner, name, releaseId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [release, setRelease] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const canManage = user && user.username === owner;

  function load() {
    setLoading(true);
    fetch(`/api/repos/${owner}/${name}/releases/${releaseId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setRelease(d.release))
      .finally(() => setLoading(false));
  }

  useEffect(load, [owner, name, releaseId]);

  async function uploadFile(file) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/repos/${owner}/${name}/releases/${releaseId}/assets`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
      toast.success("Asset uploaded");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  if (loading) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;
  if (!release) return <p className="text-[var(--color-fg-muted)]">Not found.</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 border-b border-[var(--color-border-muted)] pb-2">
        <Link to={`/${owner}/${name}/releases`} className="text-sm text-[var(--color-accent-fg)]">
          ← All releases
        </Link>
      </div>

      <div className="mb-4 rounded-md border border-[var(--color-border-default)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag size={16} className="text-[var(--color-accent-fg)]" />
          <h1 className="text-xl font-semibold">{release.name}</h1>
          <span className="rounded-full border border-[var(--color-border-default)] px-2 py-0.5 font-mono text-xs">
            {release.tag}
          </span>
          {release.is_prerelease && (
            <span className="rounded-full border border-[var(--color-attention-fg)] px-2 py-0.5 text-xs text-[var(--color-attention-fg)]">
              Pre-release
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          {release.author_username} · {new Date(release.created_at * 1000).toLocaleString()}
        </p>
        {release.body && (
          <div className="mt-3 whitespace-pre-wrap text-sm">{release.body}</div>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Assets ({release.assets?.length || 0})
          </h2>
          {canManage && (
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm text-[var(--color-btn-primary-fg)]">
              <Upload size={14} />
              {uploading ? "Uploading..." : "Upload"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])}
              />
            </label>
          )}
        </div>

        {release.assets && release.assets.length > 0 ? (
          <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
            {release.assets.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Download size={14} className="text-[var(--color-fg-muted)]" />
                  <a
                    href={`/api/repos/${owner}/${name}/releases/assets/${a.id}/download`}
                    className="truncate text-sm text-[var(--color-accent-fg)] hover:underline"
                    download
                  >
                    {a.filename}
                  </a>
                </div>
                <div className="shrink-0 text-xs text-[var(--color-fg-muted)]">
                  {formatSize(a.size)} · {a.downloads} downloads
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-6 text-center text-sm text-[var(--color-fg-muted)]">
            No assets yet.
          </div>
        )}
      </div>
    </div>
  );
}
