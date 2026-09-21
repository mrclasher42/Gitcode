import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";

export function NewPost() {
  const nav = useNavigate();
  const toast = useToast();
  const [kind, setKind] = useState("short");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [cover, setCover] = useState("");
  const [draft, setDraft] = useState(false);
  const [visibility, setVisibility] = useState("public");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, body, tags, cover, draft, visibility }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success("Post created");
      nav(`/posts/${d.slug}`);
    } catch (err) {
      toast.error(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-normal">New post</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Kind selector */}
        <div className="flex gap-2">
          {[
            { id: "short", label: "Short post" },
            { id: "article", label: "Article" },
          ].map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={
                "flex-1 rounded-md border px-3 py-2 text-sm " +
                (kind === k.id
                  ? "border-[var(--color-accent-fg)] bg-[var(--color-accent-subtle)] font-semibold text-[var(--color-accent-fg)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-btn-bg)]")
              }
            >
              {k.label}
            </button>
          ))}
        </div>

        {kind === "article" && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold">
            Body{" "}
            {kind === "short" && (
              <span className="text-xs text-[var(--color-fg-muted)]">
                ({body.length}/500)
              </span>
            )}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={kind === "article" ? 15 : 5}
            maxLength={kind === "short" ? 500 : undefined}
            required
            placeholder={kind === "article" ? "Write in Markdown..." : "What's on your mind?"}
            className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-3 font-mono text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="git, selfhosted, python"
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            Comma-separated. Up to 5 tags.
          </p>
        </div>

        {kind === "article" && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Cover image URL</label>
            <input
              type="text"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="https://..."
              className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Visibility</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "public", label: "Public", desc: "Everyone" },
              { id: "followers", label: "Followers", desc: "Your followers" },
              { id: "private", label: "Private", desc: "Only you" },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVisibility(v.id)}
                className={
                  "rounded-md border px-3 py-2 text-left text-sm " +
                  (visibility === v.id
                    ? "border-[var(--color-accent-fg)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-fg)]"
                    : "border-[var(--color-border-default)] bg-[var(--color-btn-bg)]")
                }
              >
                <div className="font-semibold">{v.label}</div>
                <div className="text-xs opacity-70">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          <span>Save as draft</span>
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-4 py-1.5 text-sm text-[var(--color-btn-primary-fg)] disabled:opacity-50"
          >
            {loading ? "Publishing..." : (draft ? "Save draft" : "Publish")}
          </button>
          <Link
            to="/posts"
            className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-4 py-1.5 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
