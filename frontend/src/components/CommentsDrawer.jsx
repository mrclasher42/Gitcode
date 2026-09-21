import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, Send, Heart, Bookmark, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { UserAvatar } from "./UserAvatar";
import { useToast } from "./Toast";
import { useConfirm } from "../hooks/useConfirm";
import { timeAgo } from "../lib/time";
import { cn } from "../lib/cn";
import { formatCount } from "../lib/format";

export function CommentsDrawer({ slug, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/posts/${slug}/comments`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setComments(d.comments || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [slug]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/posts/${slug}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!r.ok) throw new Error("Failed");
      setBody("");
      load();
    } catch {
      toast.error("Failed");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(c) {
    if (!user) return;
    try {
      const r = await fetch(`/api/comments/${c.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setComments((list) =>
        list.map((x) =>
          x.id === c.id ? { ...x, liked: d.liked, likes: d.likes } : x
        )
      );
    } catch {
      toast.error("Failed");
    }
  }

  async function toggleBookmark(c) {
    if (!user) return;
    try {
      const r = await fetch(`/api/comments/${c.id}/bookmark`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setComments((list) =>
        list.map((x) =>
          x.id === c.id ? { ...x, bookmarked: d.bookmarked } : x
        )
      );
    } catch {
      toast.error("Failed");
    }
  }

  async function deleteComment(c) {
    const ok = await confirm({
      title: "Delete comment?",
      message: "This action cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await fetch(`/api/comments/${c.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Failed");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xl flex-col rounded-t-2xl border-t border-[var(--color-border-default)] bg-[var(--color-canvas-default)]"
        style={{ maxHeight: "85vh", animation: "slideUp 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-muted)] px-4 py-3">
          <h2 className="text-base font-semibold">Comments ({comments.length})</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-[var(--color-btn-hover-bg)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-[var(--color-fg-muted)]">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-fg-muted)]">
              No comments yet. Be the first!
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-md border border-[var(--color-border-default)] p-2.5">
                  <div className="flex gap-2">
                    <UserAvatar
                      user={{ username: c.author_username, avatar: c.author_avatar }}
                      size={26}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <Link
                          to={`/${c.author_username}`}
                          className="truncate text-sm font-semibold hover:underline"
                        >
                          {c.author_username}
                        </Link>
                        <span className="text-xs text-[var(--color-fg-muted)]">
                          {timeAgo(c.created_at)}
                        </span>
                      </div>
                      <p
                        className="mt-0.5 whitespace-pre-wrap text-sm"
                        style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                      >
                        {c.body}
                      </p>

                      {/* Actions */}
                      <div className="mt-1.5 flex items-center gap-1">
                        <button
                          onClick={() => toggleLike(c)}
                          disabled={!user}
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs disabled:opacity-50",
                            c.liked
                              ? "text-[var(--color-danger-fg)]"
                              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-btn-hover-bg)]"
                          )}
                        >
                          <Heart size={12} fill={c.liked ? "currentColor" : "none"} />
                          {formatCount(c.likes || 0)}
                        </button>

                        <button
                          onClick={() => toggleBookmark(c)}
                          disabled={!user}
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs disabled:opacity-50",
                            c.bookmarked
                              ? "text-[var(--color-accent-fg)]"
                              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-btn-hover-bg)]"
                          )}
                        >
                          <Bookmark size={12} fill={c.bookmarked ? "currentColor" : "none"} />
                        </button>

                        {c.can_delete && (
                          <button
                            onClick={() => deleteComment(c)}
                            className="ml-auto rounded px-1.5 py-0.5 text-xs text-[var(--color-fg-muted)] hover:bg-[var(--color-btn-hover-bg)] hover:text-[var(--color-danger-fg)]"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Input */}
        {user ? (
          <form onSubmit={submit} className="border-t border-[var(--color-border-muted)] p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a comment..."
                className="h-9 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
              />
              <button
                type="submit"
                disabled={posting || !body.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm text-[var(--color-btn-primary-fg)] disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        ) : (
          <div className="border-t border-[var(--color-border-muted)] p-3 text-center text-sm">
            <Link to="/login" className="text-[var(--color-accent-fg)]">
              Sign in
            </Link>{" "}
            to comment
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
