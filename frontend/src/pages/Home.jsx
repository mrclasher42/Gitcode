import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Book, Globe, Lock, Star, Search, Users, GitFork } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { timeAgo } from "../lib/time";
import { UserAvatar } from "../components/UserAvatar";
import { useSettings } from "../contexts/SettingsContext";
import { cn } from "../lib/cn";

const TABS = [
  { id: "mine",     label: "your_repos",   auth: true },
  { id: "explore",  label: "explore_tab",  auth: false },
  { id: "starred",  label: "starred_tab",  auth: true },
];

export function Home() {
  const { user } = useAuth();
  const { t } = useSettings();
  const [tab, setTab] = useState(user ? "mine" : "explore");

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-muted)] pb-2">
        <h1 className="text-xl font-normal">
          {user ? `${t("hello")}, ${user.username}` : t("welcome")}
        </h1>
        {user && (
          <Link
            to="/new"
            className="inline-flex h-8 items-center rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm font-medium text-[var(--color-btn-primary-fg)] hover:bg-[var(--color-btn-primary-hover-bg)]"
          >
            {t("new_repo")}
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-[var(--color-border-muted)]">
        {TABS.filter((item) => !item.auth || user).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-1.5 text-sm",
              tab === item.id
                ? "border-[var(--color-accent-fg)] font-semibold text-[var(--color-fg-default)]"
                : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)]"
            )}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {tab === "mine" && user && <MyRepos />}
      {tab === "explore" && <Explore />}
      {tab === "starred" && user && <Starred />}

      {!user && (
        <div className="mt-6 text-center text-sm text-[var(--color-fg-muted)]">
          <Link to="/login" className="text-[var(--color-accent-fg)]">Sign in</Link> to create repositories
        </div>
      )}

      <RecentActivity />
    </div>
  );
}

function MyRepos() {
  const { t } = useSettings();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listMyRepos()
      .then((d) => setRepos(d.repos || []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;
  if (repos.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
        {t("no_repos_yet")}
      </div>
    );
  }
  return <RepoGrid repos={repos} />;
}

function Explore() {
  const { t } = useSettings();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | forks | newest | starred

  useEffect(() => {
    api.listRepos()
      .then((d) => setRepos(d.repos || []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, []);

  let filtered = repos;
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(ql) ||
        (r.description || "").toLowerCase().includes(ql) ||
        (r.owner_username || "").toLowerCase().includes(ql)
    );
  }
  if (filter === "forks") filtered = filtered.filter((r) => r.fork);
  if (filter === "newest") filtered = [...filtered].sort((a, b) => b.created_at - a.created_at);

  return (
    <div>
      {/* Search + filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search_repos")}
            className="h-9 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <div className="flex gap-1">
          {[
            { id: "all", label: "all" },
            { id: "newest", label: "newest" },
            { id: "forks", label: "forks_only" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                filter === f.id
                  ? "bg-[var(--color-accent-subtle)] font-medium text-[var(--color-accent-fg)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-canvas-subtle)]"
              )}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          {q ? `No repositories matching "${q}"` : "No repositories yet."}
        </div>
      ) : (
        <RepoGrid repos={filtered} />
      )}
    </div>
  );
}

function Starred() {
  const { t } = useSettings();
  const { user } = useAuth();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.user(user.username)
      .then((d) => setRepos(d.starred || []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;
  if (repos.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
        {t("no_starred")}
      </div>
    );
  }
  return <RepoGrid repos={repos} starred />;
}

function RepoGrid({ repos, starred = false }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {repos.map((r) => (
        <Link
          key={r.id}
          to={`/${r.owner_username}/${r.name}`}
          className="gc-card group flex flex-col rounded-lg border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-4 transition-colors hover:border-[var(--color-accent-fg)]"
        >
          <div className="mb-2 flex items-start gap-2">
            {starred ? (
              <Star size={16} className="mt-0.5 shrink-0 text-[var(--color-attention-fg)]" />
            ) : (
              <Book size={16} className="mt-0.5 shrink-0 text-[var(--color-fg-muted)]" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="truncate text-[var(--color-fg-muted)]">
                  {r.owner_username} /
                </span>
                <span className="truncate font-semibold text-[var(--color-accent-fg)] group-hover:underline">
                  {r.name}
                </span>
              </div>
            </div>
            <span className="shrink-0 text-[var(--color-fg-muted)]">
              {r.is_private ? <Lock size={12} /> : <Globe size={12} />}
            </span>
          </div>

          <p className="gc-card-description mb-3 line-clamp-2 min-h-[2.5rem] text-sm text-[var(--color-fg-muted)]">
            {r.description || <span className="italic">No description</span>}
          </p>

          <div className="gc-card-meta mt-auto flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
            <div className="flex items-center gap-3">
              {r.fork && (
                <span className="inline-flex items-center gap-1">
                  <GitFork size={11} /> fork
                </span>
              )}
              <span>{timeAgo(r.updated_at)}</span>
            </div>
            {r.is_private && <Lock size={11} />}
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecentActivity() {
  const { t } = useSettings();
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetch("/api/activities?limit=15", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setActivities(d.activities || []))
      .catch(() => {});
  }, []);

  if (activities.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="mb-3 border-b border-[var(--color-border-muted)] pb-2 text-base font-semibold">
        {t("recent_activity")}
      </h2>
      <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
        {activities.map((a) => (
          <li key={a.id} className="flex items-start gap-2 px-3 py-2 text-sm">
            <UserAvatar user={{ username: a.username, avatar: a.user_avatar }} size={24} />
            <div className="min-w-0 flex-1">
              <span className="font-semibold">{a.username}</span>
              <span className="text-[var(--color-fg-muted)]"> {activityVerb(a.kind, t)} </span>
              {a.repo_name && (
                <Link
                  to={`/${a.repo_owner}/${a.repo_name}`}
                  className="text-[var(--color-accent-fg)]"
                >
                  {a.repo_owner}/{a.repo_name}
                </Link>
              )}
              {a.detail && (
                <span className="text-[var(--color-fg-muted)]"> — {a.detail}</span>
              )}
              <span className="ml-2 text-xs text-[var(--color-fg-muted)]">
                {timeAgo(a.created_at)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function activityVerb(kind, t) {
  switch (kind) {
    case "star": return t("activity_star");
    case "watch": return t("activity_watch");
    case "fork": return t("activity_fork");
    case "commit": return t("activity_commit");
    case "issue": return t("activity_issue");
    case "create_repo": return t("activity_create_repo");
    case "post_comment": return t("activity_comment");
    default: return kind;
  }
}
