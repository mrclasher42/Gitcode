import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { useAuth } from "../contexts/AuthContext";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError("Invalid username or password.");
        return;
      }
      if (d.requires_2fa) {
        setNeeds2FA(true);
        return;
      }
      nav("/");
      window.location.reload();
    } catch (err) {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function verify2FA(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/2fa/verify-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error === "invalid_code" ? "Invalid code" : "Failed");
        return;
      }
      nav("/");
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-4 text-center text-xl font-normal">Sign in to GitCode</h1>
      {needs2FA ? (
        <form
          onSubmit={verify2FA}
          className="space-y-4 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] p-4"
        >
          <p className="text-center text-sm text-[var(--color-fg-muted)]">
            Enter the 6-digit code from your authenticator app
          </p>
          {error && (
            <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
              {error}
            </div>
          )}
          <input
            type="text"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="000000"
            autoFocus
            inputMode="numeric"
            className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 py-3 text-center font-mono text-2xl tracking-widest outline-none focus:border-[var(--color-accent-fg)]"
          />
          <Button type="submit" variant="primary" className="w-full" disabled={loading || totpCode.length < 6}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <button
            type="button"
            onClick={() => setNeeds2FA(false)}
            className="w-full text-sm text-[var(--color-fg-muted)]"
          >
            Back to login
          </button>
        </form>
      ) : (
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] p-4"
      >
        {error && (
          <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Username</label>
          <input
            type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            required autoComplete="username"
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required autoComplete="current-password"
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      )}
      <p className="mt-4 text-center text-sm">
        New to GitCode? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}
