import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { useAuth } from "../contexts/AuthContext";

export function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(username, email, password);
      nav("/");
    } catch (err) {
      const code = err.data && err.data.error;
      if (code === "username_taken") setError("Username is already taken.");
      else if (code === "invalid_username") setError("Invalid username (letters, numbers, hyphens).");
      else if (code === "password_too_short") setError("Password must be at least 6 characters.");
      else setError("Signup failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-4 text-center text-xl font-normal">Create your account</h1>
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
            required minLength={1} maxLength={39}
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={6}
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">At least 6 characters.</p>
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
