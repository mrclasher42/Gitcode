import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { File, Folder, Book, ScrollText, List, GitFork } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { CloneMenu } from "../components/CloneMenu";
import { cn } from "../lib/cn";

const TABS = [
  { id: "readme",  label: "README",  icon: Book },
  { id: "license", label: "License", icon: ScrollText },
  { id: "files",   label: "Files",   icon: List },
];

export function Repo() {
  const { owner, name } = useParams();
  const nav = useNavigate();

  const [repo, setRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState("main");
  const [tree, setTree] = useState([]);
  const [commits, setCommits] = useState([]);
  const [readme, setReadme] = useState("");
  const [license, setLicense] = useState("");
  const [tab, setTab] = useState("readme");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forking, setForking] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError("");

    api.getRepo(owner, name)
      .then((d) => {
        if (cancel) return;
        setRepo(d.repo);
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

    api.getTree(owner, name, branch, "")
      .then((d) => setTree(d.entries || []))
      .catch(() => setTree([]));

    api.getCommits(owner, name, branch)
      .then((d) => setCommits(d.commits || []))
      .catch(() => setCommits([]));

    // Try README.gc first, then README.md
    api.getBlob(owner, name, branch, "README.gc")
      .then((d) => setReadme(d.content))
      .catch(() => {
        api.getBlob(owner, name, branch, "README.md")
          .then((d) => setReadme(d.content))
          .catch(() => setReadme(""));
      });

    // Try LICENSE, LICENSE.md, LICENSE.gc
    api.getBlob(owner, name, branch, "LICENSE")
      .then((d) => setLicense(d.content))
      .catch(() => {
        api.getBlob(owner, name, branch, "LICENSE.md")
          .then((d) => setLicense(d.content))
          .catch(() => {
            api.getBlob(owner, name, branch, "LICENSE.gc")
              .then((d) => setLicense(d.content))
              .catch(() => setLicense(""));
          });
      });
  }, [repo, owner, name, branch]);

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
    } finally {
      setForking(false);
    }
  }

  if (loading) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;
  if (error) return (
    <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
      {error}
    </div>
  );

  const hasReadme = readme.length > 0;
  const hasLicense = license.length > 0;
  const visibleTabs = TABS.filter((t) => {
    if (t.id === "readme") return hasReadme;
    if (t.id === "license") return hasLicense;
    return true;
  });

  // Force tab to a visible one
  const currentTab = visibleTabs.find((t) => t.id === tab) ? tab : (visibleTabs[0]?.id || "files");

  return (
    <div>
      {/* Header */}
      <div className="mb-4 border-b border-[var(--color-border-muted)] pb-2">
        <h1 className="text-xl font-normal">
          <Link to={`/${owner}`} className="text-[var(--color-accent-fg)]">{owner}</Link>
          <span className="text-[var(--color-fg-muted)]"> / </span>
          <span className="font-semibold">{name}</span>
        </h1>
        {repo.description && (
          <p className="text-sm text-[var(--color-fg-muted)]">{repo.description}</p>
        )}
      </div>

      {repo.fork && (
        <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
          forked from{" "}
          <Link
            to={`/${repo.fork.parent_owner}/${repo.fork.parent_name}`}
            className="text-[var(--color-accent-fg)]"
          >
            {repo.fork.parent_owner}/{repo.fork.parent_name}
          </Link>
        </p>
      )}

      {user && user.username !== owner && (
        <div className="mb-3">
          <button
            onClick={handleFork}
            disabled={forking}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-btn-border)] bg-[var(--color-btn-bg)] px-3 py-1.5 text-sm hover:bg-[var(--color-btn-hover-bg)] disabled:opacity-50"
          >
            <GitFork size={14} />
            {forking ? "Forking..." : "Fork"}
          </button>
        </div>
      )}

      {/* Branch + Code row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

      {/* Tabs */}
      <div className="mb-3 border-b border-[var(--color-border-muted)]">
        <nav className="flex gap-1">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = currentTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
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
      </div>

      {/* Tab content */}
      {currentTab === "readme" && (
        <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-4">
          <MarkdownView>{readme}</MarkdownView>
        </div>
      )}

      {currentTab === "license" && (
        <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-4">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--color-fg-muted)]">
            {license}
          </pre>
        </div>
      )}

      {currentTab === "files" && (
        <>
          <div className="rounded-md border border-[var(--color-border-default)]">
            {tree.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--color-fg-muted)]">
                Empty repository.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border-muted)]">
                {tree.map((e) => (
                  <li key={e.path} className="flex items-center gap-2 px-3 py-2 text-sm">
                    {e.type === "tree" ? <Folder size={16} /> : <File size={16} />}
                    <Link
                      to={`/${owner}/${name}/blob/${branch}/${e.path}`}
                      className="text-[var(--color-accent-fg)]"
                    >
                      {e.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {commits.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-base font-semibold">Recent commits</h2>
              <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
                {commits.slice(0, 10).map((c) => (
                  <li key={c.sha} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{c.message}</div>
                      <div className="text-xs text-[var(--color-fg-muted)]">
                        {c.author_name} &middot; {new Date(c.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                    <code className="ml-3 text-xs text-[var(--color-fg-muted)]">
                      {c.sha.slice(0, 7)}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Markdown renderer with GitHub-like styles */

function MarkdownView({ children }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="mb-4 mt-2 border-b border-[var(--color-border-muted)] pb-2 text-2xl font-semibold" {...props} />,
          h2: (props) => <h2 className="mb-3 mt-6 border-b border-[var(--color-border-muted)] pb-1.5 text-xl font-semibold" {...props} />,
          h3: (props) => <h3 className="mb-2 mt-5 text-lg font-semibold" {...props} />,
          h4: (props) => <h4 className="mb-2 mt-4 text-base font-semibold" {...props} />,
          p:  (props) => <p className="mb-3 leading-relaxed" {...props} />,
          ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-6" {...props} />,
          ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-6" {...props} />,
          li: (props) => <li {...props} />,
          a:  (props) => <a className="text-[var(--color-accent-fg)] hover:underline" {...props} />,
          strong: (props) => <strong className="font-semibold" {...props} />,
          code: ({ inline, children, ...props }) =>
            inline ? (
              <code className="rounded bg-[var(--color-canvas-subtle)] px-1.5 py-0.5 font-mono text-xs" {...props}>
                {children}
              </code>
            ) : (
              <code className="font-mono text-xs" {...props}>{children}</code>
            ),
          pre: (props) => (
            <pre className="mb-3 overflow-x-auto rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] p-3 font-mono text-xs leading-relaxed" {...props} />
          ),
          blockquote: (props) => (
            <blockquote className="mb-3 border-l-4 border-[var(--color-border-default)] pl-3 text-[var(--color-fg-muted)]" {...props} />
          ),
          table: (props) => (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          thead: (props) => <thead className="bg-[var(--color-canvas-subtle)]" {...props} />,
          th: (props) => <th className="border border-[var(--color-border-default)] px-3 py-1.5 text-left font-semibold" {...props} />,
          td: (props) => <td className="border border-[var(--color-border-default)] px-3 py-1.5" {...props} />,
          hr: (props) => <hr className="my-4 border-[var(--color-border-muted)]" {...props} />,
          img: (props) => <img className="my-2 max-w-full rounded" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
