import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/Button";

export function RepoSettings() {
  const { owner, name } = useParams();
  const nav = useNavigate();
  const [repo, setRepo] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Edit form
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  // Delete
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.getRepo(owner, name)
      .then((d) => {
        setRepo(d.repo);
        setDescription(d.repo.description || "");
        setIsPrivate(!!d.repo.is_private);
        setDefaultBranch(d.repo.default_branch || "main");
      })
      .catch(() => setError("Repository not found."))
      .finally(() => setLoading(false));
  }, [owner, name]);

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved("");
    setError("");
    try {
      await api.updateRepo(owner, name, {
        description,
        private: isPrivate,
        default_branch: defaultBranch,
      });
      setSaved("Settings saved.");
      setTimeout(() => setSaved(""), 2000);
    } catch (err) {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(e) {
    e.preventDefault();
    if (confirmDelete !== `${owner}/${name}`) {
      setError("Type the full name to confirm.");
      return;
    }
    setDeleting(true);
    try {
      await api.deleteRepo(owner, name);
      nav("/");
    } catch (err) {
      setError("Failed to delete.");
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;
  if (error && !repo) {
    return (
      <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 border-b border-[var(--color-border-muted)] pb-2 text-xl font-normal">
        Settings - <span className="font-semibold">{owner}/{name}</span>
      </h1>

      <nav className="mb-4 flex gap-3 text-sm">
        <Link to={`/${owner}/${name}`} className="text-[var(--color-accent-fg)]">
          ← Back to repository
        </Link>
      </nav>

      {saved && (
        <div className="mb-3 rounded-md border border-[var(--color-success-emphasis)] bg-[var(--color-success-subtle)] px-3 py-2 text-sm text-[var(--color-success-fg)]">
          {saved}
        </div>
      )}
      {error && repo && (
        <div className="mb-3 rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
          {error}
        </div>
      )}

      <form onSubmit={onSave} className="mb-6 space-y-4">
        <h2 className="text-base font-semibold">General</h2>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Default branch</label>
          <input
            type="text"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="mt-1"
          />
          <span>
            Private repository
            <span className="block text-xs text-[var(--color-fg-muted)]">
              Only you can see this repository.
            </span>
          </span>
        </label>

        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </form>

      <hr className="my-6 border-[var(--color-border-muted)]" />

      <form onSubmit={onDelete} className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-danger-fg)]">
          Danger zone
        </h2>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Once you delete a repository, there is no going back. All commits,
          branches, and history will be permanently deleted.
        </p>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">
            Type <code className="font-mono">{owner}/{name}</code> to confirm
          </label>
          <input
            type="text"
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-danger-fg)]"
          />
        </div>
        <Button
          type="submit"
          variant="danger"
          disabled={deleting || confirmDelete !== `${owner}/${name}`}
        >
          {deleting ? "Deleting..." : "Delete this repository"}
        </Button>
      </form>
    </div>
  );
}
