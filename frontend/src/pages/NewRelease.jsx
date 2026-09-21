import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { useToast } from "../components/Toast";

export function NewRelease() {
  const { owner, name } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [tag, setTag] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [prerelease, setPrerelease] = useState(false);
  const [draft, setDraft] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch(`/api/repos/${owner}/${name}/releases`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, name: title || tag, body, prerelease, draft }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success("Release created");
      nav(`/${owner}/${name}/releases/${d.id}`);
    } catch (err) {
      toast.error(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 border-b border-[var(--color-border-muted)] pb-2">
        <Link to={`/${owner}/${name}/releases`} className="text-sm text-[var(--color-accent-fg)]">
          ← Back to releases
        </Link>
        <h1 className="mt-2 text-xl font-normal">Create a new release</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">
            Tag <span className="text-[var(--color-danger-fg)]">*</span>
          </label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="v1.0.0"
            required
            autoFocus
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 font-mono text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Release title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="First stable release"
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="What's changed in this release?"
            className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>

        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={prerelease} onChange={(e) => setPrerelease(e.target.checked)} />
            <span>Set as a pre-release</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
            <span>Save as draft</span>
          </label>
        </div>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={loading || !tag.trim()}>
            {loading ? "Creating..." : "Publish release"}
          </Button>
          <Link to={`/${owner}/${name}/releases`} className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 py-1 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
