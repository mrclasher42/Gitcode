import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Folder, File, Book, ScrollText, List } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { CloneMenu } from "../components/CloneMenu";
import { RepoTabs } from "../components/RepoTabs";

const SUBTABS = [
  { id: "readme",  label: "README",  icon: Book },
  { id: "license", label: "License", icon: ScrollText },
  { id: "files",   label: "Files",   icon: List },
];

export function Repo() {
  const { owner, name } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { t } = useSettings();

  const [repo, setRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState("main");
  const [tree, setTree] = useState([]);
  const [commits, setCommits] = useState([]);
  const [readme, setReadme] = useState("");
  const [hasReadmeGc, setHasReadmeGc] = useState(false);
  const [license, setLicense] = useState("");
  const [tab, setTab] = useState("readme");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forking, setForking] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [social, setSocial] = useState({ stars: 0, watches: 0, forks: 0, starred: false, watching: false });

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError("");
    api.getRepo(owner, name)
      .then((d) => {
        if (cancel) return;
        setRepo(d.repo);
        setDescValue(d.repo.description || "");
        return api.getBranches(owner, name);
      })
      .then((d) => {
        if (cancel || !d) return;
        setBranches(d.branches || []);
        setBranch(d.default_branch || "main");
      })
      .catch((e) => {
        if (cancel) return;
        setError(e.status === 404 ? "Repository not found." : "Failed to load.");
      })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [owner, name]);

  useEffect(() => {
    if (!repo) return;
    api.getTree(owner, name, branch, "").then((d) => setTree(d.entries || [])).catch(() => setTree([]));
    api.getCommits(owner, name, branch).then((d) => setCommits(d.commits || [])).catch(() => setCommits([]));
    api.getSocial(owner, name).then((d) => setSocial(d)).catch(() => {});
    api.getBlob(owner, name, branch, "README.gc")
      .then((d) => { setReadme(d.content); setHasReadmeGc(true); })
      .catch(() => {
        api.getBlob(owner, name, branch, "README.md")
          .then((d) => { setReadme(d.content); setHasReadmeGc(false); })
          .catch(() => { setReadme(""); setHasReadmeGc(false); });
      });
    api.getBlob(owner, name, branch, "LICENSE").then((d) => setLicense(d.content)).catch(() => setLicense(""));
  }, [repo, owner, name, branch]);

  async function toggleStar() {
    if (!user) return;
    try {
      const d = await api.toggleStar(owner, name);
      setSocial((s) => ({ ...s, starred: d.starred, stars: d.stars }));
    } catch {}
  }
  async function toggleWatch() {
    if (!user) return;
    try {
      const d = await api.toggleWatch(owner, name);
      setSocial((s) => ({ ...s, watching: d.watching, watches: d.watches }));
    } catch {}
  }
  async function handleFork() {
    if (!user) return;
    setForking(true);
    try {
      const d = await api.forkRepo(owner, name);
      nav(`/${d.repo.owner_username}/${d.repo.name}`);
    } catch (err) {
      const code = err.data && err.data.error;
      if (code === "fork_already_exists") alert("You already forked this repo.");
      else if (code === "cannot_fork_own_repo") alert("Cannot fork your own repo.");
      else alert("Fork failed.");
    } finally { setForking(false); }
  }
  async function saveDescription() {
    try {
      const d = await api.updateRepo(owner, name, { description: descValue });
      setRepo(d.repo);
      setEditingDesc(false);
    } catch {}
  }

  if (loading) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;
  if (error) return (
    <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
      {error}
    </div>
  );

  const visibleTabs = SUBTABS.filter((t) => {
    if (t.id === "readme") return readme.length > 0;
    if (t.id === "license") return license.length > 0;
    return true;
  });
  const currentTab = visibleTabs.find((t) => t.id === tab) ? tab : (visibleTabs[0]?.id || "files");

  return (
    <div>
      {/* Header: owner/name + Settings */}
      <div className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-normal">
            <Link to={`/${owner}`} className="text-[var(--color-accent-fg)]">{owner}</Link>
            <span className="text-[var(--color-fg-muted)]"> / </span>
            <span className="font-semibold">{name}</span>
          </h1>
          {user && user.username === owner && (
            <Link to={`/${owner}/${name}/settings`} className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent-fg)]">
              {t("settings")}
            </Link>
          )}
        </div>

        {editingDesc ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              autoFocus
              className="h-7 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-2 text-sm outline-none focus:border-[var(--color-accent-fg)]"
              onKeyDown={(e) => { if (e.key === "Enter") saveDescription(); if (e.key === "Escape") setEditingDesc(false); }}
            />
            <button onClick={saveDescription} className="rounded-md border border-[var(--color-btn-border)] bg-[var(--color-btn-primary-bg)] px-2.5 py-1 text-xs text-[var(--color-btn-primary-fg)]">Save</button>
            <button onClick={() => { setDescValue(repo.description || ""); setEditingDesc(false); }} className="rounded-md border border-[var(--color-btn-border)] bg-[var(--color-btn-bg)] px-2.5 py-1 text-xs">Cancel</button>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-[var(--color-fg-muted)]">
              {repo.description || <span className="italic">{t("no_description")}</span>}
            </p>
            {user && user.username === owner && (
              <button onClick={() => setEditingDesc(true)} className="text-xs text-[var(--color-accent-fg)] hover:underline">Edit</button>
            )}
          </div>
        )}
      </div>

      {/* Watch / Fork / Star actions */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleWatch}
          disabled={!user}
          className={
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm disabled:opacity-50 " +
            (social.watching
              ? "border-[var(--color-accent-fg)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-fg)]"
              : "border-[var(--color-border-default)] bg-[var(--color-btn-bg)] hover:bg-[var(--color-btn-hover-bg)]")
          }
        >
          {social.watching ? t("unwatch") : t("watch")}{" "}
          <span className="opacity-70">{social.watches}</span>
        </button>

        <button
          type="button"
          onClick={handleFork}
          disabled={forking || !user}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 text-sm hover:bg-[var(--color-btn-hover-bg)] disabled:opacity-50"
        >
          {t("fork")} <span className="opacity-70">{social.forks}</span>
        </button>

        <button
          type="button"
          onClick={toggleStar}
          disabled={!user}
          className={
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm disabled:opacity-50 " +
            (social.starred
              ? "border-[#bf8700] bg-[#fff8c5] text-[#7a5d00]"
              : "border-[var(--color-border-default)] bg-[var(--color-btn-bg)] hover:bg-[var(--color-btn-hover-bg)]")
          }
        >
          {social.starred ? t("starred_state") : t("star")}{" "}
          <span className="opacity-70">{social.stars}</span>
        </button>
      </div>

      {/* RepoTabs — سطر التبويبات الرئيسي */}
      <RepoTabs />

      {/* Content */}
      <div className="mt-4">
        {/* Branch + Clone row (فقط عند Code tab) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {branches.length > 0 && (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="h-8 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-2 text-sm"
              >
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
          </div>
          <CloneMenu owner={owner} name={name} />
        </div>

        {/* Sub-tabs داخل card */}
        <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)]">
          {/* Sub-tabs header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border-muted)]">
            <nav className="flex gap-1 no-scrollbar overflow-x-auto">
              {visibleTabs.map((t) => {
                const Icon = t.icon;
                const active = currentTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm",
                      active
                        ? "border-[var(--color-accent-fg)] font-semibold text-[var(--color-fg-default)]"
                        : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)]"
                    )}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </nav>

            {currentTab === "readme" && user && user.username === owner && (
              <Link
                to={`/${owner}/${name}/edit/${branch}/${hasReadmeGc ? "README.gc" : "README.md"}`}
                className="mr-3 text-xs text-[var(--color-accent-fg)] hover:underline"
              >
                Edit
              </Link>
            )}
          </div>

          {/* Sub-tab content */}
          {currentTab === "readme" && (
            <div className="p-4">
              <MarkdownView>{readme}</MarkdownView>
            </div>
          )}

          {currentTab === "license" && (
            <div className="p-4">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--color-fg-muted)]">{license}</pre>
            </div>
          )}

          {currentTab === "files" && (
            <>
              {tree.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--color-fg-muted)]">Empty repository.</div>
              ) : (
                <ul className="gc-list divide-y divide-[var(--color-border-muted)]">
                  {tree.map((e) => (
                    <li key={e.path} className="flex items-center gap-2 px-4 py-2 text-sm">
                      {e.type === "tree" ? <Folder size={16} /> : <File size={16} />}
                      <Link
                        to={e.type === "tree"
                          ? `/${owner}/${name}/tree/${branch}/${e.path}`
                          : `/${owner}/${name}/blob/${branch}/${e.path}`}
                        className="text-[var(--color-accent-fg)]"
                      >
                        {e.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Recent commits (فقط في Files tab) */}
        {currentTab === "files" && commits.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-base font-semibold">Recent commits</h2>
            <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
              {commits.slice(0, 10).map((c) => (
                <li key={c.sha} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <Link to={`/${owner}/${name}/commit/${c.sha}`} className="min-w-0 hover:underline">
                    <div className="truncate text-[var(--color-accent-fg)]">{c.message}</div>
                    <div className="text-xs text-[var(--color-fg-muted)]">
                      {c.author_name} · {new Date(c.timestamp * 1000).toLocaleString()}
                    </div>
                  </Link>
                  <Link to={`/${owner}/${name}/commit/${c.sha}`} className="shrink-0 rounded border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] px-1.5 py-0.5 font-mono text-xs">
                    {c.sha.slice(0, 7)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MarkdownView({ children }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="mb-4 mt-2 border-b border-[var(--color-border-muted)] pb-2 text-2xl font-semibold" {...props} />,
          h2: (props) => <h2 className="mb-3 mt-6 border-b border-[var(--color-border-muted)] pb-1.5 text-xl font-semibold" {...props} />,
          h3: (props) => <h3 className="mb-2 mt-5 text-lg font-semibold" {...props} />,
          p:  (props) => <p className="mb-3 leading-relaxed" {...props} />,
          ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-6" {...props} />,
          ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-6" {...props} />,
          a:  (props) => <a className="text-[var(--color-accent-fg)] hover:underline" {...props} />,
          code: ({ inline, children, ...props }) =>
            inline ? <code className="rounded bg-[var(--color-canvas-subtle)] px-1.5 py-0.5 font-mono text-xs" {...props}>{children}</code>
                   : <code className="font-mono text-xs" {...props}>{children}</code>,
          pre: (props) => <pre className="mb-3 no-scrollbar overflow-x-auto rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] p-3 font-mono text-xs leading-relaxed" {...props} />,
          table: (props) => <div className="mb-3 no-scrollbar overflow-x-auto"><table className="w-full border-collapse text-sm" {...props} /></div>,
          th: (props) => <th className="border border-[var(--color-border-default)] px-3 py-1.5 text-left font-semibold" {...props} />,
          td: (props) => <td className="border border-[var(--color-border-default)] px-3 py-1.5" {...props} />,
          hr: (props) => <hr className="my-4 border-[var(--color-border-muted)]" {...props} />,
          img: (props) => <img className="my-2 max-w-full rounded" {...props} />,
          blockquote: (props) => <blockquote className="mb-3 border-l-4 border-[var(--color-border-default)] pl-3 text-[var(--color-fg-muted)]" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
