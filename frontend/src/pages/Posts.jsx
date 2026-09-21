import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PenSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../contexts/AuthContext";
import { UserAvatar } from "../components/UserAvatar";
import { useToast } from "../components/Toast";
import { useSettings } from "../contexts/SettingsContext";
import { CommentsDrawer } from "../components/CommentsDrawer";
import { PostActions } from "../components/PostActions";
import { timeAgo } from "../lib/time";
import { cn } from "../lib/cn";

export function Posts() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const feed = params.get("feed") || "all";
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drawerSlug, setDrawerSlug] = useState(null);
  const { t } = useSettings();
  const containerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    const url = feed === "following" ? "/api/posts?feed=following" : "/api/posts";
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [feed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveIndex(Number(entry.target.getAttribute("data-index")));
          }
        });
      },
      { root: container, threshold: 0.6 }
    );
    container.querySelectorAll(".feed-item").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [posts]);

  function changeFeed(f) {
    const next = new URLSearchParams(params);
    next.set("feed", f);
    setParams(next);
  }

  async function toggleLike(post) {
    if (!user) return;
    try {
      const r = await fetch(`/api/posts/${post.slug}/like`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPosts((list) =>
        list.map((p) => p.slug === post.slug ? { ...p, liked: d.liked, likes: d.likes } : p)
      );
    } catch { toast.error("Failed"); }
  }

  async function toggleBookmark(post) {
    if (!user) return;
    try {
      const r = await fetch(`/api/posts/${post.slug}/bookmark`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPosts((list) =>
        list.map((p) => p.slug === post.slug ? { ...p, bookmarked: d.bookmarked } : p)
      );
    } catch { toast.error("Failed"); }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-[var(--color-fg-muted)]">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-muted)] px-1 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => changeFeed("all")}
            className={cn(
              "rounded-md px-3 py-1 text-sm",
              feed === "all"
                ? "bg-[var(--color-accent-subtle)] font-semibold text-[var(--color-accent-fg)]"
                : "text-[var(--color-fg-muted)] hover:bg-[var(--color-canvas-subtle)]"
            )}
          >
            {t("for_you")}
          </button>
          {user && (
            <button
              onClick={() => changeFeed("following")}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                feed === "following"
                  ? "bg-[var(--color-accent-subtle)] font-semibold text-[var(--color-accent-fg)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-canvas-subtle)]"
              )}
            >
              {t("following_feed")}
            </button>
          )}
        </div>
        {user && (
          <Link
            to="/posts/new"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm text-[var(--color-btn-primary-fg)]"
          >
            <PenSquare size={14} />
            <span className="hidden sm:inline">New</span>
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          {feed === "following" ? t("no_posts_following") : t("no_posts")}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="no-scrollbar"
          style={{
            height: "calc(100vh - 170px)",
            overflowY: "scroll",
            scrollSnapType: "y mandatory",
            overscrollBehavior: "contain",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {posts.map((p, i) => (
            <div
              key={p.id}
              data-index={i}
              className="feed-item"
              style={{
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
                minHeight: "calc(100vh - 170px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.75rem",
                transition: "opacity 0.4s ease, transform 0.4s ease",
                opacity: activeIndex === i ? 1 : 0.35,
                transform: activeIndex === i ? "scale(1)" : "scale(0.96)",
              }}
            >
              <article className="gc-card w-full max-w-xl overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-4">
                {/* Author */}
                <div className="mb-2 flex items-center gap-2">
                  <UserAvatar
                    user={{ username: p.author_username, avatar: p.author_avatar }}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/${p.author_username}`}
                      className="block truncate text-sm font-semibold hover:underline"
                    >
                      {p.author_username}
                    </Link>
                    <div className="text-xs text-[var(--color-fg-muted)]">
                      {timeAgo(p.created_at)}
                    </div>
                  </div>
                  {p.kind === "article" && (
                    <span className="rounded-full border border-[var(--color-border-default)] px-2 py-0.5 text-xs text-[var(--color-fg-muted)]">
                      {t("article")}
                    </span>
                  )}
                </div>

                {/* Clickable content */}
                <Link to={`/posts/${p.slug}`} className="block">
                  {p.title && (
                    <h2
                      className="mb-1.5 truncate text-lg font-semibold"
                      title={p.title}
                    >
                      {p.title.length > 70 ? p.title.slice(0, 70) + "…" : p.title}
                    </h2>
                  )}

                  <div
                    className="md-body text-sm leading-relaxed"
                    style={{
                      maxHeight: "32vh",
                      overflow: "hidden",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {p.kind === "article" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {p.body.length > 400 ? p.body.slice(0, 400) + "\n\n..." : p.body}
                      </ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {p.body.length > 300 ? p.body.slice(0, 300) + "..." : p.body}
                      </p>
                    )}
                  </div>

                  {p.body.length > 300 && (
                    <span className="mt-1.5 inline-block text-xs text-[var(--color-accent-fg)]">
                      {t("read_more")} →
                    </span>
                  )}

                  {p.tags && (
                    <div className="gc-card-tags mt-2 flex flex-wrap gap-1">
                      {p.tags
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
                </Link>

                <PostActions
                  likes={p.likes || 0}
                  comments={p.comments || 0}
                  liked={p.liked}
                  bookmarked={p.bookmarked}
                  onLike={() => toggleLike(p)}
                  onComment={() => setDrawerSlug(p.slug)}
                  onBookmark={() => toggleBookmark(p)}
                  disabled={!user}
                />
              </article>
            </div>
          ))}

          <div
            className="flex items-center justify-center text-sm text-[var(--color-fg-muted)]"
            style={{ scrollSnapAlign: "start", minHeight: "calc(100vh - 170px)" }}
          >
            {t("done")}
          </div>
        </div>
      )}

      {drawerSlug && (
        <CommentsDrawer slug={drawerSlug} onClose={() => setDrawerSlug(null)} />
      )}
    </div>
  );
}
