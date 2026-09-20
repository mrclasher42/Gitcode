import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/Button";

export function NewRepo() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priv, setPriv] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const d = await api.createRepo(name, description, priv);
      nav(`/${d.repo.owner_username}/${d.repo.name}`);
    } catch (err) {
      if (err.data && err.data.error === "repo_exists") setError("Repository already exists.");
      else if (err.data && err.data.error === "invalid_repo_name") setError("Invalid name.");
      else setError("Failed to create repository.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 border-b border-[var(--color-border-muted)] pb-2 text-xl font-normal">
        Create a new repository
      </h1>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Repository name</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            required pattern="[A-Za-z0-9._-]+"
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description</label>
          <input
            type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="mt-1" />
          <span>Private repository</span>
        </label>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Creating..." : "Create repository"}
        </Button>
      </form>
    </div>
  );
}
