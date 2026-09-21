import { useEffect, useState } from "react";
import { X, Shield, Copy, Check } from "lucide-react";
import { copyToClipboard } from "../lib/clipboard";

export function TwoFactorSetup({ onClose, onEnabled }) {
  const [step, setStep] = useState("loading");
  const [secret, setSecret] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disablePwd, setDisablePwd] = useState("");
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    // Check current status first
    fetch("/api/2fa/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.enabled) {
          setStep("enabled");
          return;
        }
        // Then create new setup
        return fetch("/api/2fa/setup", { method: "POST", credentials: "include" });
      })
      .then((r) => {
        if (!r) return null;
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.error) {
          setError(d.error);
          return;
        }
        setSecret(d.secret || "");
        setQrUrl(d.qr_url || "");
        setStep("qr");
      })
      .catch((e) => setError("Failed: " + e.message));
  }, []);

  async function disable2FA(e) {
    if (e) e.preventDefault();
    setError("");
    setDisabling(true);
    try {
      const r = await fetch("/api/2fa/disable", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePwd }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error === "invalid_password" ? "Wrong password" : "Failed");
        return;
      }
      onClose();
    } catch {
      setError("Failed");
    } finally {
      setDisabling(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError("");
    setVerifying(true);
    try {
      const r = await fetch("/api/2fa/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error === "invalid_code" ? "Invalid code. Try again." : (d.error || "Failed"));
        return;
      }
      setBackupCodes(d.backup_codes || []);
      setStep("backup");
      if (onEnabled) onEnabled();
    } catch (e) {
      setError("Failed: " + e.message);
    } finally {
      setVerifying(false);
    }
  }

  async function copySecret() {
    const ok = await copyToClipboard(secret);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function copyBackupCodes() {
    await copyToClipboard(backupCodes.join("\n"));
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield size={18} />
            Two-Factor Authentication
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-[var(--color-btn-hover-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
            {error}
          </div>
        )}

        {step === "loading" && (
          <p className="text-sm text-[var(--color-fg-muted)]">Loading...</p>
        )}

        {step === "enabled" && (
          <div>
            <div className="mb-3 rounded-md border border-[var(--color-success-emphasis)] bg-[var(--color-success-subtle)] px-3 py-2 text-sm text-[var(--color-success-fg)]">
              2FA is enabled on your account.
            </div>
            <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
              You will be asked for a code from your authenticator app when signing in.
            </p>
            <form onSubmit={disable2FA} className="space-y-2">
              <input
                type="password"
                value={disablePwd}
                onChange={(e) => setDisablePwd(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 py-2 text-sm outline-none focus:border-[var(--color-danger-fg)]"
              />
              <button
                type="submit"
                disabled={disabling || !disablePwd}
                className="w-full rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm font-medium text-[var(--color-danger-fg)] disabled:opacity-50"
              >
                {disabling ? "Disabling..." : "Disable 2FA"}
              </button>
            </form>
          </div>
        )}

        {step === "qr" && (
          <>
            <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
              Scan this QR code with Google Authenticator, Authy, or any TOTP app.
            </p>
            <div className="mb-3 flex justify-center rounded-md bg-white p-3">
              {qrUrl ? (
                <img src={qrUrl} alt="QR" className="h-48 w-48" />
              ) : (
                <p className="text-black">QR not available</p>
              )}
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold uppercase text-[var(--color-fg-muted)]">
                Or enter this secret manually
              </label>
              <div className="flex gap-2">
                <code className="flex-1 break-all rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] px-3 py-2 font-mono text-xs">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-2"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep("verify")}
              className="w-full rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 py-2 text-sm font-medium text-[var(--color-btn-primary-fg)]"
            >
              Continue
            </button>
          </>
        )}

        {step === "verify" && (
          <form onSubmit={verify}>
            <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
              Enter the 6-digit code from your authenticator app.
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              className="mb-3 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 py-3 text-center font-mono text-2xl tracking-widest outline-none focus:border-[var(--color-accent-fg)]"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={code.length !== 6 || verifying}
                className="flex-1 rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 py-2 text-sm font-medium text-[var(--color-btn-primary-fg)] disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Enable 2FA"}
              </button>
              <button
                type="button"
                onClick={() => setStep("qr")}
                className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 py-2 text-sm"
              >
                Back
              </button>
            </div>
          </form>
        )}

        {step === "backup" && (
          <>
            <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
              Save these backup codes in a safe place. Each can be used once.
            </p>
            <div className="mb-3 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)] p-3">
              <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                {backupCodes.map((c, i) => (
                  <div key={i}>{c}</div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={copyBackupCodes}
              className="mb-2 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 py-2 text-sm"
            >
              Copy all codes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 py-2 text-sm font-medium text-[var(--color-btn-primary-fg)]"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
