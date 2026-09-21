import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";

export function NewIssue() {
  const { owner, name } = useParams();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/repos/${owner}/${name}/issues`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      // Redirect to issues list (we don't know number yet; could add)
      nav(`/${owner}/${name}/issues`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 border-b border-[var(--color-border-muted)] pb-2">
        <Link
          to={`/${owner}/${name}/issues`}
          className="text-sm text-[var(--color-accent-fg)]"
        >
          ← All issues
        </Link>
        <h1 className="mt-2 text-xl font-normal">New issue</h1>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <Button type="submit" variant="primary" disabled={loading || !title.trim()}>
          {loading ? "Creating..." : "Create issue"}
        </Button>
      </form>
    </div>
  );
}
