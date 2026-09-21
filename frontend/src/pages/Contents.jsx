import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { File, Folder, Download, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";
import { CodeBlock } from "../components/CodeBlock";

function detectKind(path) {
  const ext = (path.split(".").pop() || "").toLowerCase();
  const images = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"];
  const markdown = ["md", "markdown", "gc"];
  const text = [
    "txt", "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "c", "h", "cpp",
    "cs", "php", "html", "htm", "css", "scss", "sass", "json", "xml", "yml", "yaml",
    "toml", "ini", "cfg", "conf", "sh", "bash", "zsh", "fish", "ps1",
    "gitignore", "gitattributes", "editorconfig", "env", "lock",
    "sql", "graphql", "vue", "svelte", "lockfile",
  ];
  const binary = [
    "zip", "gz", "tar", "bz2", "xz", "7z", "rar",
    "exe", "dll", "so", "dylib", "bin", "class", "jar",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "woff", "woff2", "ttf", "otf", "eot",
    "mp3", "mp4", "avi", "mov", "wav", "ogg", "webm",
    "db", "sqlite",
  ];
  const base = path.split("/").pop() || "";
  if (base.startsWith(".")) return "text";
  if (base.toLowerCase() === "license") return "text";
  if (images.includes(ext)) return "image";
  if (markdown.includes(ext)) return "markdown";
  if (text.includes(ext)) return "text";
  if (binary.includes(ext)) return "binary";
  return "text";
}

export function Contents() {
  const { owner, name, branch, "*": path = "" } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const rawUrl = `/api/repos/${owner}/${name}/raw?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`;

  useEffect(() => {
    setError("");
    setLoading(true);
    setData(null);

    fetch(`/api/repos/${owner}/${name}/contents?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "not found");
        setData(d);
      })
      .catch((e) => setError(e.message || "Failed to load."))
      .finally(() => setLoading(false));
  }, [owner, name, branch, path]);

  const segments = path ? path.split("/") : [];
  const parentPath = segments.length > 1 ? segments.slice(0, -1).join("/") : "";

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-muted)] pb-2 text-sm">
        <div className="min-w-0 break-all">
          <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
            {owner}/{name}
          </Link>
          {segments.length > 0 && (
            <>
              <span className="text-[var(--color-fg-muted)]"> / </span>
              {segments.map((seg, i) => {
                const p = segments.slice(0, i + 1).join("/");
                const isLast = i === segments.length - 1;
                return (
                  <span key={p}>
                    {isLast ? (
                      <span className="font-mono text-[var(--color-fg-default)]">{seg}</span>
                    ) : (
                      <>
                        <Link
                          to={`/${owner}/${name}/tree/${branch}/${p}`}
                          className="font-mono text-[var(--color-accent-fg)]"
                        >
                          {seg}
                        </Link>
                        <span className="text-[var(--color-fg-muted)]"> / </span>
                      </>
                    )}
                  </span>
                );
              })}
            </>
          )}
        </div>
        {data && data.type === "file" && (
          <div className="flex gap-2">
            <Link
              to={`/${owner}/${name}/edit/${branch}/${path}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-2.5 py-1 text-xs hover:bg-[var(--color-btn-hover-bg)]"
            >
              Edit
            </Link>
            <a
              href={rawUrl}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-2.5 py-1 text-xs hover:bg-[var(--color-btn-hover-bg)]"
            >
              <Download size={12} />
              Raw
            </a>
          </div>
        )}
      </div>

      {loading && <p className="text-[var(--color-fg-muted)]">Loading...</p>}
      {error && (
        <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
          {error}
        </div>
      )}

      {/* DIR VIEW */}
      {data && data.type === "dir" && (
        <div className="rounded-md border border-[var(--color-border-default)]">
          {path && (
            <div className="flex items-center gap-2 border-b border-[var(--color-border-muted)] px-3 py-2 text-sm">
              <button
                onClick={() => nav(`/${owner}/${name}/tree/${branch}/${parentPath}`)}
                className="inline-flex items-center gap-1 text-[var(--color-accent-fg)]"
              >
                <ArrowLeft size={14} /> ..
              </button>
            </div>
          )}
          {data.entries.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--color-fg-muted)]">
              Empty directory.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border-muted)]">
              {data.entries.map((e) => (
                <li key={e.path} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {e.type === "tree" ? (
                    <Folder size={16} className="text-[var(--color-accent-fg)]" />
                  ) : (
                    <File size={16} className="text-[var(--color-fg-muted)]" />
                  )}
                  <Link
                    to={
                      e.type === "tree"
                        ? `/${owner}/${name}/tree/${branch}/${e.path}`
                        : `/${owner}/${name}/blob/${branch}/${e.path}`
                    }
                    className="text-[var(--color-accent-fg)]"
                  >
                    {e.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* FILE VIEW */}
      {data && data.type === "file" && (
        <FileView
          owner={owner}
          name={name}
          branch={branch}
          path={data.path}
          content={data.content}
          rawUrl={rawUrl}
        />
      )}
    </div>
  );
}

function FileView({ path, content, rawUrl, owner, name, branch }) {
  const kind = detectKind(path);

  if (kind === "image") {
    return (
      <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] p-4 text-center">
        <img src={rawUrl} alt={path} className="mx-auto max-h-[70vh] max-w-full rounded" />
      </div>
    );
  }

  if (kind === "binary") {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center">
        <p className="mb-3 text-sm text-[var(--color-fg-muted)]">Binary file not shown.</p>
        <a
          href={rawUrl}
          download
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-primary-bg)] px-3 py-1.5 text-sm text-[var(--color-btn-primary-fg)]"
        >
          <Download size={14} /> Download
        </a>
      </div>
    );
  }

  if (kind === "markdown") {
    return (
      <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-4">
        <MarkdownView>{content}</MarkdownView>
      </div>
    );
  }

  return <CodeBlock>{content}</CodeBlock>;
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
            inline ? (
              <code className="rounded bg-[var(--color-canvas-subtle)] px-1.5 py-0.5 font-mono text-xs" {...props}>{children}</code>
            ) : (
              <code className="font-mono text-xs" {...props}>{children}</code>
            ),
          pre: (props) => (
            <pre className="mb-3 no-scrollbar overflow-x-auto rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] p-3 font-mono text-xs leading-relaxed" {...props} />
          ),
          table: (props) => (
            <div className="mb-3 no-scrollbar overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: (props) => <th className="border border-[var(--color-border-default)] px-3 py-1.5 text-left font-semibold" {...props} />,
          td: (props) => <td className="border border-[var(--color-border-default)] px-3 py-1.5" {...props} />,
          hr: (props) => <hr className="my-4 border-[var(--color-border-muted)]" {...props} />,
          img: (props) => <img className="my-2 max-w-full rounded" {...props} />,
          blockquote: (props) => (
            <blockquote className="mb-3 border-l-4 border-[var(--color-border-default)] pl-3 text-[var(--color-fg-muted)]" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
