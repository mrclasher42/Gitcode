import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";

export function EditFile() {
  const { settings } = useSettings();
  const { owner, name, branch, "*": path } = useParams();
  const nav = useNavigate();
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isNew = path === "" || path === "_new";

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    fetch(`/api/repos/${owner}/${name}/contents?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.type === "file") setContent(d.content);
        else setError("Not a file.");
      })
      .catch(() => setError("Failed to load."))
      .finally(() => setLoading(false));
  }, [owner, name, branch, path, isNew]);

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
          content,
          message: message || ("Update " + path),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      nav(`/${owner}/${name}/blob/${branch}/${path}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--color-border-muted)] pb-2">
        <h1 className="text-base font-normal">
          {isNew ? "New file" : "Edit"}:{" "}
          <span className="font-mono">{path}</span>
        </h1>
        <Link
          to={`/${owner}/${name}/blob/${branch}/${path}`}
          className="text-sm text-[var(--color-fg-muted)]"
        >
          Cancel
        </Link>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div
          className="mb-3 flex overflow-hidden rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)]"
          style={{ minHeight: "400px" }}
        >
          {settings?.show_line_numbers ? (
            <div className="select-none border-r border-[var(--color-border-muted)] bg-[var(--color-canvas-subtle)] px-3 py-3 font-mono text-xs leading-relaxed text-[var(--color-fg-muted)]">
              {content.split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          ) : null}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            spellCheck={false}
            className="editor-textarea flex-1 resize-none bg-transparent p-3 outline-none focus:outline-none"
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: "14px",
              lineHeight: "1.5",
            }}
          />
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-sm font-semibold">
            Commit message
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={"Update " + path}
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>

        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Committing..." : "Commit changes"}
        </Button>
      </form>
    </div>
  );
}
