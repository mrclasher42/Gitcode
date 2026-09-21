import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GitBranch, Trash2, Star } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { RepoTabs } from "../components/RepoTabs";

export function Branches() {
  const { owner, name } = useParams();
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [defaultBranch, setDefaultBranch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFrom, setNewFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canManage = user && user.username === owner;

  function load() {
    setLoading(true);
    fetch(`/api/repos/${owner}/${name}/branches/full`)
      .then((r) => r.json())
      .then((d) => {
        setBranches(d.branches || []);
        setDefaultBranch(d.default_branch || "");
        setNewFrom(d.default_branch || "");
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [owner, name]);

  async function createBranch(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/repos/${owner}/${name}/branches`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, from: newFrom }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setNewName("");
      setShowNew(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteBranch(b) {
    if (!confirm(`Delete branch "${b}"?`)) return;
    try {
      const r = await fetch(`/api/repos/${owner}/${name}/branches/${encodeURIComponent(b)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function setDefault(b) {
    try {
      const r = await fetch(`/api/repos/${owner}/${name}/branches`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: b }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-muted)] pb-2">
        <h1 className="text-xl font-normal">
          <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
            {owner}/{name}
          </Link>
          <span className="text-[var(--color-fg-muted)]"> / branches</span>
        </h1>
        {canManage && (
          <button
            onClick={() => setShowNew((v) => !v)}
            className="inline-flex h-8 items-center rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm text-[var(--color-btn-primary-fg)] hover:bg-[var(--color-btn-primary-hover-bg)]"
          >
            New branch
          </button>
        )}
      </div>

      <RepoTabs />

      {showNew && canManage && (
        <form onSubmit={createBranch} className="mb-4 rounded-md border border-[var(--color-border-default)] p-4">
          {error && (
            <div className="mb-3 rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
              {error}
            </div>
          )}
          <div className="mb-3">
            <label className="mb-1.5 block text-sm font-semibold">Branch name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
              className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 font-mono text-sm outline-none focus:border-[var(--color-accent-fg)]"
            />
          </div>
          <div className="mb-3">
            <label className="mb-1.5 block text-sm font-semibold">Create from</label>
            <select
              value={newFrom}
              onChange={(e) => setNewFrom(e.target.value)}
              className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-2 text-sm"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 py-1 text-sm text-[var(--color-btn-primary-fg)] disabled:opacity-50"
          >
            {busy ? "Creating..." : "Create branch"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-[var(--color-fg-muted)]">Loading...</p>
      ) : branches.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-10 text-center text-[var(--color-fg-muted)]">
          No branches.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
          {branches.map((b) => (
            <li key={b.name} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <GitBranch size={16} className="shrink-0 text-[var(--color-fg-muted)]" />
                  <Link
                    to={`/${owner}/${name}/tree/${b.name}`}
                    className="truncate font-mono text-sm font-semibold text-[var(--color-accent-fg)]"
                  >
                    {b.name}
                  </Link>
                  {b.is_default && (
                    <span className="shrink-0 rounded-full border border-[var(--color-border-default)] px-2 py-0.5 text-xs text-[var(--color-fg-muted)]">
                      default
                    </span>
                  )}
                </div>

                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    {!b.is_default && (
                      <>
                        <button
                          onClick={() => setDefault(b.name)}
                          title="Set as default"
                          className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] p-1.5 text-xs hover:bg-[var(--color-btn-hover-bg)]"
                        >
                          <Star size={12} />
                        </button>
                        <button
                          onClick={() => deleteBranch(b.name)}
                          title="Delete"
                          className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] p-1.5 text-xs text-[var(--color-danger-fg)] hover:bg-[var(--color-btn-hover-bg)]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {b.last_commit && (
                <div className="mt-1 pl-6 text-xs text-[var(--color-fg-muted)]">
                  <Link
                    to={`/${owner}/${name}/commit/${b.last_commit.sha}`}
                    className="hover:underline"
                  >
                    {b.last_commit.message}
                  </Link>
                  <span className="ml-2">
                    by {b.last_commit.author_name} · {new Date(b.last_commit.timestamp * 1000).toLocaleDateString()}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
