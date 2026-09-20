import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

export function Blob() {
  const { owner, name, branch, "*": path } = useParams();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.getBlob(owner, name, branch, path)
      .then((d) => setContent(d.content))
      .catch(() => setError("File not found."));
  }, [owner, name, branch, path]);

  return (
    <div>
      <div className="mb-3 text-sm">
        <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
          {owner}/{name}
        </Link>
        <span className="text-[var(--color-fg-muted)]"> / </span>
        <span className="font-mono">{path}</span>
      </div>
      {error ? (
        <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
          {error}
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] p-4 font-mono text-xs leading-relaxed">
          <code>{content}</code>
        </pre>
      )}
    </div>
  );
}
