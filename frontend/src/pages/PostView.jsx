import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Trash2, Eye, MessageCircle, Heart, Bookmark } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../contexts/AuthContext";
import { UserAvatar } from "../components/UserAvatar";
import { useToast } from "../components/Toast";
import { useConfirm } from "../hooks/useConfirm";
import { PostActions } from "../components/PostActions";
import { timeAgo } from "../lib/time";
import { formatCount } from "../lib/format";

export function PostView() {
  const { slug } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/posts/${slug}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPost(d.post))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
    fetch(`/api/posts/${slug}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments || []))
      .catch(() => setComments([]));
  }

  useEffect(load, [slug]);

  async function toggleLike() {
    if (!user) return;
    try {
      const r = await fetch(`/api/posts/${slug}/like`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPost((p) => ({ ...p, liked: d.liked, likes: d.likes }));
    } catch {
      toast.error("Failed");
    }
  }

  async function toggleBookmark() {
    if (!user) return;
    try {
      const r = await fetch(`/api/posts/${slug}/bookmark`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPost((p) => ({ ...p, bookmarked: d.bookmarked }));
    } catch {
      toast.error("Failed");
    }
  }

  async function deletePost() {
    const ok = await confirm({
      title: "Delete?",
      message: "This action cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await fetch(`/api/posts/${slug}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      toast.success("Deleted");
      nav("/posts");
    } catch {
      toast.error("Failed");
    }
  }

  async function toggleCommentLike(c) {
    if (!user) return;
    try {
      const r = await fetch(`/api/comments/${c.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setComments((list) =>
        list.map((x) =>
          x.id === c.id ? { ...x, liked: d.liked, likes: d.likes } : x
        )
      );
    } catch (e) {
      toast.error("Like failed");
    }
  }

  async function toggleCommentBookmark(c) {
    if (!user) return;
    try {
      const r = await fetch(`/api/comments/${c.id}/bookmark`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setComments((list) =>
        list.map((x) =>
          x.id === c.id ? { ...x, bookmarked: d.bookmarked } : x
        )
      );
    } catch (e) {
      toast.error("Bookmark failed");
    }
  }

  async function deleteComment(c) {
    const ok = await confirm({
      title: "Delete?",
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
    } catch (e) {
      toast.error("Delete failed");
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/posts/${slug}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      if (!r.ok) throw new Error("Failed");
      setCommentBody("");
      load();
    } catch {
      toast.error("Failed");
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return <p className="text-[var(--color-fg-muted)]">Loading...</p>;
  }
  if (!post) {
    return <p className="text-[var(--color-fg-muted)]">Post not found.</p>;
  }

  const canEdit = user && user.username === post.author_username;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 text-sm">
        <Link to="/posts" className="text-[var(--color-accent-fg)]">
          ← All posts
        </Link>
      </div>

      <article className="mb-6 overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-4 sm:p-6">
        {/* Author row */}
        <div className="mb-3 flex items-center gap-2">
          <UserAvatar
            user={{ username: post.author_username, avatar: post.author_avatar }}
            size={40}
          />
          <div className="min-w-0 flex-1">
            <Link
              to={`/${post.author_username}`}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {post.author_username}
            </Link>
            <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
              <span>{timeAgo(post.created_at)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Eye size={11} /> {formatCount(post.views)}
              </span>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={deletePost}
              className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] p-1.5 text-[var(--color-danger-fg)] hover:bg-[var(--color-btn-hover-bg)]"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Title */}
        {post.title && (
          <h1
            className="mb-3 text-xl font-semibold sm:text-2xl"
            style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
          >
            {post.title}
          </h1>
        )}

        {/* Cover */}
        {post.cover && (
          <img
            src={post.cover}
            alt="cover"
            className="mb-3 w-full rounded-md"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        )}

        {/* Body */}
        <div
          className="md-body text-sm leading-relaxed sm:text-base"
          style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
        >
          {post.kind === "article" ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
          ) : (
            <p className="whitespace-pre-wrap">{post.body}</p>
          )}
        </div>

        {/* Tags */}
        {post.tags && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] px-2 py-0.5 text-xs text-[var(--color-fg-muted)]"
                >
                  #{t}
                </span>
              ))}
          </div>
        )}

        <PostActions
          likes={post.likes}
          comments={comments.length}
          liked={post.liked}
          bookmarked={post.bookmarked}
          onLike={toggleLike}
          onComment={() =>
            document
              .getElementById("comments-section")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          onBookmark={toggleBookmark}
          disabled={!user}
        />
      </article>

      {/* Comments */}
      <section id="comments-section">
        <h2 className="mb-3 text-base font-semibold">
          Comments ({comments.length})
        </h2>

        {comments.length > 0 && (
          <ul className="mb-4 space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-[var(--color-border-default)] p-3"
              >
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

                    <div className="mt-1.5 flex items-center gap-1">
                      <button
                        onClick={() => toggleCommentLike(c)}
                        disabled={!user}
                        className={
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs disabled:opacity-50 " +
                          (c.liked
                            ? "text-[var(--color-danger-fg)]"
                            : "text-[var(--color-fg-muted)] hover:bg-[var(--color-btn-hover-bg)]")
                        }
                      >
                        <Heart size={12} fill={c.liked ? "currentColor" : "none"} />
                        {c.likes || 0}
                      </button>

                      <button
                        onClick={() => toggleCommentBookmark(c)}
                        disabled={!user}
                        className={
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs disabled:opacity-50 " +
                          (c.bookmarked
                            ? "text-[var(--color-accent-fg)]"
                            : "text-[var(--color-fg-muted)] hover:bg-[var(--color-btn-hover-bg)]")
                        }
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

        {user ? (
          <form
            onSubmit={submitComment}
            className="rounded-md border border-[var(--color-border-default)] p-3"
          >
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={3}
              placeholder="Write a comment..."
              className="mb-2 w-full resize-none rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-2 text-sm outline-none focus:border-[var(--color-accent-fg)]"
            />
            <button
              type="submit"
              disabled={posting || !commentBody.trim()}
              className="rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 py-1.5 text-sm text-[var(--color-btn-primary-fg)] disabled:opacity-50"
            >
              {posting ? "Posting..." : "Comment"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-[var(--color-fg-muted)]">
            <Link to="/login" className="text-[var(--color-accent-fg)]">
              Sign in
            </Link>{" "}
            to comment.
          </p>
        )}
      </section>
    </div>
  );
}
