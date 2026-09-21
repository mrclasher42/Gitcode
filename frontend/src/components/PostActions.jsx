import { Heart, MessageCircle, Bookmark } from "lucide-react";
import { cn } from "../lib/cn";
import { formatCount } from "../lib/format";

export function PostActions({
  likes = 0,
  comments = 0,
  liked = false,
  bookmarked = false,
  onLike,
  onComment,
  onBookmark,
  disabled = false,
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md border text-sm transition-colors disabled:opacity-50";

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-border-muted)] pt-3">
      <button
        onClick={onLike}
        disabled={disabled}
        title="Like"
        className={cn(
          base,
          "h-8 px-2.5",
          liked
            ? "border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] text-[var(--color-danger-fg)]"
            : "border-[var(--color-border-default)] bg-[var(--color-btn-bg)] hover:bg-[var(--color-btn-hover-bg)]"
        )}
      >
        <Heart size={14} fill={liked ? "currentColor" : "none"} />
        <span>{formatCount(likes)}</span>
      </button>

      <button
        onClick={onComment}
        title="Comments"
        className={cn(
          base,
          "h-8 px-2.5 border-[var(--color-border-default)] bg-[var(--color-btn-bg)] hover:bg-[var(--color-btn-hover-bg)]"
        )}
      >
        <MessageCircle size={14} />
        <span>{formatCount(comments)}</span>
      </button>

      <button
        onClick={onBookmark}
        disabled={disabled}
        title={bookmarked ? "Saved" : "Save"}
        className={cn(
          base,
          "ml-auto h-8 w-8 justify-center",
          bookmarked
            ? "border-[var(--color-accent-fg)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-fg)]"
            : "border-[var(--color-border-default)] bg-[var(--color-btn-bg)] hover:bg-[var(--color-btn-hover-bg)]"
        )}
      >
        <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
