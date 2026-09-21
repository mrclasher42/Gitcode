import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";

export function NewFile() {
  const { settings } = useSettings();
  const { owner, name, branch } = useParams();
  const nav = useNavigate();
  const [path, setPath] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/repos/${owner}/${name}/file`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          content: "",
          message: message || ("Create " + path),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      nav(`/${owner}/${name}/edit/${branch}/${path}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 border-b border-[var(--color-border-muted)] pb-2 text-xl font-normal">
        New file
      </h1>
      <Link
        to={`/${owner}/${name}`}
        className="mb-3 inline-block text-sm text-[var(--color-fg-muted)]"
      >
        ← Back to repository
      </Link>

      {error && (
        <div className="mb-3 rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">File path</label>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="folder/name.txt"
            required
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 font-mono text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            Use forward slashes to create folders.
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Commit message</label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add new file"
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Creating..." : "Create file"}
        </Button>
      </form>
    </div>
  );
}
