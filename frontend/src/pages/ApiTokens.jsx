import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Copy, Check, Key } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../hooks/useConfirm";

export function ApiTokens() {
  const { t } = useSettings();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState(30);
  const [scopes, setScopes] = useState(["read", "write"]);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [copied, setCopied] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/tokens", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens || []))
      .catch(() => setTokens([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function toggleScope(s) {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function createToken(e) {
    e.preventDefault();
    if (!name.trim() || scopes.length === 0) return;
    setCreating(true);
    try {
      const r = await fetch("/api/tokens", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, days, scopes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setNewToken(d.token);
      load();
    } catch (e) {
      console.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function deleteToken(id, name) {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: "The token will stop working immediately.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await fetch(`/api/tokens/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      load();
    } catch (e) {
      console.error(e.message);
    }
  }

  async function copyToken(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Copy failed");
    }
  }

  function resetForm() {
    setName("");
    setDays(30);
    setScopes(["read", "write"]);
    setNewToken("");
  }

  if (!user) {
    return <p className="text-[var(--color-fg-muted)]">{t("loading")}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 border-b border-[var(--color-border-muted)] pb-2 text-xl font-normal">
        {t("settings_title")}
      </h1>

      <nav className="mb-4 text-sm">
        <Link to={`/${user.username}`} className="text-[var(--color-accent-fg)]">
          ← {t("back")}
        </Link>
      </nav>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("api_tokens")}</h2>
          {!showNew && !newToken && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 py-1 text-sm text-[var(--color-btn-primary-fg)]"
            >
              <Plus size={14} /> {t("new_token")}
            </button>
          )}
        </div>

        <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
          {t("tokens_desc")}
        </p>

        {newToken && (
          <div className="mb-4 rounded-md border border-[var(--color-success-emphasis)] bg-[var(--color-success-subtle)] p-3">
            <div className="mb-2 text-sm font-semibold text-[var(--color-success-fg)]">
              {t("token_created_msg")}
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={newToken}
                onFocus={(e) => e.target.select()}
                className="h-8 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-2 font-mono text-xs"
              />
              <button
                onClick={() => copyToken(newToken)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 text-sm"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
            <div className="mt-2">
              <button
                onClick={() => { setNewToken(""); setShowNew(false); resetForm(); }}
                className="text-sm text-[var(--color-accent-fg)]"
              >
                {t("done")}
              </button>
            </div>
          </div>
        )}

        {showNew && !newToken && (
          <form
            onSubmit={createToken}
            className="mb-4 space-y-3 rounded-md border border-[var(--color-border-default)] p-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t("name")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("token_name_ph")}
                required
                autoFocus
                className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t("expires")}</label>
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-2 text-sm"
              >
                <option value={7}>{t("days_7")}</option>
                <option value={30}>{t("days_30")}</option>
                <option value={90}>{t("days_90")}</option>
                <option value={365}>{t("days_365")}</option>
                <option value={0}>{t("no_expiration")}</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t("scopes")}</label>
              <div className="space-y-1 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scopes.includes("read")}
                    onChange={() => toggleScope("read")}
                  />
                  <span><b>read</b> - {t("scope_read")}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scopes.includes("write")}
                    onChange={() => toggleScope("write")}
                  />
                  <span><b>write</b> - {t("scope_write")}</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !name.trim() || scopes.length === 0}
                className="rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 py-1 text-sm text-[var(--color-btn-primary-fg)] disabled:opacity-50"
              >
                {creating ? t("saving") : t("create_token")}
              </button>
              <button
                type="button"
                onClick={() => { setShowNew(false); resetForm(); }}
                className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 py-1 text-sm"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-[var(--color-fg-muted)]">{t("loading")}</p>
        ) : tokens.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-6 text-center text-sm text-[var(--color-fg-muted)]">
            {t("no_tokens")}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
            {tokens.map((tk) => (
              <li key={tk.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Key size={16} className="shrink-0 text-[var(--color-fg-muted)]" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{tk.name}</div>
                  <div className="text-xs text-[var(--color-fg-muted)]">
                    {tk.scopes} ·{" "}
                    {tk.expires_at
                      ? `${t("expires")} ${new Date(tk.expires_at * 1000).toLocaleDateString()}`
                      : t("no_expiration")}
                  </div>
                </div>
                <button
                  onClick={() => deleteToken(tk.id, tk.name)}
                  className="shrink-0 rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] p-1.5 text-[var(--color-danger-fg)]"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
