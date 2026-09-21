import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell, Star, Eye, GitFork, UserPlus, MessageCircle, CircleDot, Trash2,
} from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";
import { useConfirm } from "../hooks/useConfirm";
import { UserAvatar } from "../components/UserAvatar";
import { timeAgo } from "../lib/time";
import { cn } from "../lib/cn";

function iconFor(kind) {
  const size = 16;
  switch (kind) {
    case "star": return <Star size={size} className="text-[var(--color-attention-fg)]" />;
    case "watch": return <Eye size={size} className="text-[var(--color-accent-fg)]" />;
    case "fork": return <GitFork size={size} className="text-[var(--color-accent-fg)]" />;
    case "follow": return <UserPlus size={size} className="text-[var(--color-accent-fg)]" />;
    case "issue": return <CircleDot size={size} className="text-[var(--color-success-fg)]" />;
    case "comment":
    case "post_comment": return <MessageCircle size={size} className="text-[var(--color-fg-muted)]" />;
    default: return <Bell size={size} />;
  }
}

function verbFor(kind, t) {
  switch (kind) {
    case "star": return t("notif_star");
    case "watch": return t("notif_watch");
    case "fork": return t("notif_fork");
    case "follow": return t("notif_follow");
    case "issue": return t("notif_issue");
    case "comment": return t("notif_comment");
    case "post_comment": return t("notif_post_comment");
    default: return kind;
  }
}

function linkFor(n) {
  if (n.kind === "follow") return `/${n.actor_username}`;

  if (n.kind === "post_comment" && n.target_id) {
    return `/posts/${n.target_id}`;
  }

  if (n.kind === "issue" && n.target_id && n.repo_owner && n.repo_name) {
    return `/${n.repo_owner}/${n.repo_name}/issues/${n.target_id}`;
  }

  if (n.kind === "comment" && n.target_id && n.repo_owner && n.repo_name) {
    return `/${n.repo_owner}/${n.repo_name}/issues/${n.target_id}`;
  }

  if ((n.kind === "star" || n.kind === "watch" || n.kind === "fork")
      && n.repo_owner && n.repo_name) {
    return `/${n.repo_owner}/${n.repo_name}`;
  }

  return "/";
}

export function Notifications() {
  const { t } = useSettings();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/notifications", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setItems(d.notifications || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  async function clearAll() {
    const ok = await confirm({
      title: t("clear_all"),
      message: "All notifications will be removed.",
      confirmLabel: t("delete"),
      danger: true,
    });
    if (!ok) return;
    await fetch("/api/notifications/clear", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setItems([]);
  }

  async function deleteOne(e, id) {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
    setItems((list) => list.filter((x) => x.id !== id));
  }

  useEffect(() => {
    load();
    const tid = setTimeout(() => {
      fetch("/api/notifications/read", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(tid);
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border-muted)] pb-2">
        <h1 className="flex items-center gap-2 text-xl font-normal">
          <Bell size={20} />
          {t("notifications")}
        </h1>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-2.5 py-1 text-xs text-[var(--color-danger-fg)] hover:bg-[var(--color-btn-hover-bg)]"
          >
            <Trash2 size={12} />
            {t("clear_all")}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">{t("loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          <Bell size={32} className="mx-auto mb-3 opacity-40" />
          <p>{t("no_notifications")}</p>
          <p className="mt-1 text-xs">{t("no_notifications_hint")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
          {items.map((n) => (
            <li
              key={n.id}
              onClick={() => nav(linkFor(n))}
              className={cn(
                "group flex cursor-pointer items-start gap-3 border-l-4 px-4 py-3 transition-colors hover:bg-[var(--color-canvas-subtle)]",
                !n.is_read
                  ? "border-l-[var(--color-accent-emphasis)] bg-[var(--color-accent-subtle)]"
                  : "border-l-transparent"
              )}
            >
              <div className="mt-0.5 shrink-0">{iconFor(n.kind)}</div>
              <UserAvatar
                user={{ username: n.actor_username, avatar: n.actor_avatar }}
                size={32}
              />
              <div className="min-w-0 flex-1 text-sm">
                <Link
                  to={`/${n.actor_username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-[var(--color-accent-fg)]"
                >
                  {n.actor_username}
                </Link>
                <span className="text-[var(--color-fg-muted)]">
                  {" "}{verbFor(n.kind, t)}{" "}
                </span>
                {n.repo_name && n.repo_owner && (
                  <span className="font-mono text-[var(--color-fg-default)]">
                    {n.repo_owner}/{n.repo_name}
                  </span>
                )}
                {n.detail && (
                  <span className="text-[var(--color-fg-muted)]"> — {n.detail}</span>
                )}
                <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                  {timeAgo(n.created_at)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!n.is_read && (
                  <span className="h-2 w-2 rounded-full bg-[var(--color-accent-emphasis)]" />
                )}
                <button
                  type="button"
                  onClick={(e) => deleteOne(e, n.id)}
                  className="rounded-md p-1 text-[var(--color-fg-muted)] opacity-0 transition-opacity hover:bg-[var(--color-btn-hover-bg)] hover:text-[var(--color-danger-fg)] group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
