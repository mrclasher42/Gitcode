import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  X, Palette, User, Shield, Bell, Eye, Code,
  LogOut, Key, ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { TwoFactorSetup } from "./TwoFactorSetup";
import { UserAvatar } from "./UserAvatar";
import { cn } from "../lib/cn";
import { t } from "../lib/i18n";

export function SettingsDrawer({ onClose }) {
  const { user, logout } = useAuth();
  const { settings, update } = useSettings();
  const lang = settings.language || "en";
  const T = (key) => t(lang, key);

  const [showPwd, setShowPwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [show2FA, setShow2FA] = useState(false);

  const isPublicProfile = !!settings.profile_public;
  const effectiveVisibility = isPublicProfile ? settings.default_visibility : "private";

  async function savePassword(e) {
    e.preventDefault();
    setPwdError("");
    setSavingPwd(true);
    try {
      const r = await fetch("/api/users/me/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.error === "invalid_current_password") setPwdError(T("err_current_pwd"));
        else if (d.error === "password_too_short") setPwdError(T("err_pwd_short"));
        else setPwdError(T("err_failed"));
        return;
      }
      setCurrentPwd("");
      setNewPwd("");
      setShowPwd(false);
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleLogout() {
    onClose();
    await logout();
    window.location.href = "/";
  }

  function onTogglePublicProfile(v) {
    update("profile_public", v ? 1 : 0);
    if (!v) {
      // Force private when profile is not public
      update("default_visibility", "private");
    }
  }

  useEffect(() => {
    if (!user) return;
    fetch("/api/2fa/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTwoFAEnabled(!!d.enabled))
      .catch(() => {});
  }, [user, show2FA]);

  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--color-border-default)] bg-[var(--color-canvas-default)]"
        style={{ animation: "slideIn 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-muted)] px-4 py-3">
          <h2 className="text-lg font-semibold">{T("settings_title")}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-[var(--color-btn-hover-bg)]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile */}
          <div className="border-b border-[var(--color-border-muted)] p-4">
            <Link
              to={`/${user.username}`}
              onClick={onClose}
              className="flex items-center gap-3"
            >
              <UserAvatar user={user} size={52} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold">{user.username}</div>
                {user.email && (
                  <div className="truncate text-xs text-[var(--color-fg-muted)]">
                    {user.email}
                  </div>
                )}
              </div>
              <ChevronRight size={18} className={cn("text-[var(--color-fg-muted)]", lang === "ar" && "rtl-flip")} />
            </Link>
          </div>

          {/* 1. Appearance */}
          <Section icon={Palette} title={T("appearance")}>
            <SelectRow
              label={T("theme")}
              value={settings.theme}
              onChange={(v) => update("theme", v)}
              options={[
                { value: "system", label: T("system") },
                { value: "light", label: T("light") },
                { value: "dark", label: T("dark") },
              ]}
              lang={lang}
            />
            <SelectRow
              label={T("language")}
              value={settings.language}
              onChange={(v) => update("language", v)}
              options={[
                { value: "en", label: "English" },
                { value: "ar", label: "العربية" },
              ]}
              lang={lang}
            />
          </Section>

          {/* 2. Account */}
          <Section icon={User} title={T("account")}>
            <ActionRow
              label={T("edit_profile")}
              onClick={() => {
                onClose();
                window.location.href = "/" + user.username;
              }}
              lang={lang}
            />
            <ActionRow
              label={T("change_password")}
              onClick={() => setShowPwd((v) => !v)}
              lang={lang}
            />
            {showPwd && (
              <form onSubmit={savePassword} className="mt-3 space-y-2 border-t border-[var(--color-border-muted)] pt-3">
                {pwdError && (
                  <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-xs text-[var(--color-danger-fg)]">
                    {pwdError}
                  </div>
                )}
                <input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder={T("current_password")}
                  required
                  className="h-9 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
                />
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder={T("new_password")}
                  required
                  minLength={6}
                  className="h-9 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingPwd}
                    className="rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 py-1.5 text-sm text-[var(--color-btn-primary-fg)] disabled:opacity-50"
                  >
                    {savingPwd ? T("saving") : T("change")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPwd(false); setPwdError(""); }}
                    className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 py-1.5 text-sm"
                  >
                    {T("cancel")}
                  </button>
                </div>
              </form>
            )}

            <ActionRow
              icon={Key}
              label={T("api_tokens")}
              onClick={() => {
                onClose();
                window.location.href = "/settings/tokens";
              }}
              lang={lang}
            />

            <ActionRow
              icon={Shield}
              label={T("two_factor")}
              hint={twoFAEnabled ? T("enabled") : T("disabled")}
              onClick={() => setShow2FA(true)}
              lang={lang}
            />
          </Section>

          {/* 3. Privacy */}
          <Section icon={Eye} title={T("privacy")}>
            <ToggleRow
              label={T("public_profile")}
              checked={isPublicProfile}
              onChange={onTogglePublicProfile}
            />
            <SelectRow
              label={T("default_visibility")}
              value={effectiveVisibility}
              onChange={(v) => update("default_visibility", v)}
              disabled={!isPublicProfile}
              options={[
                { value: "public", label: T("public") },
                { value: "followers", label: T("followers") },
                { value: "private", label: T("private") },
              ]}
              lang={lang}
            />
            <ToggleRow
              label={T("show_email")}
              checked={!!settings.show_email}
              onChange={(v) => update("show_email", v ? 1 : 0)}
            />
            {!isPublicProfile && (
              <p className="text-xs text-[var(--color-fg-muted)]">
                {lang === "ar"
                  ? "لأن الملف الشخصي خاص، منشوراتك الجديدة ستكون خاصة تلقائياً."
                  : "Because your profile is private, new posts will be private by default."}
              </p>
            )}
          </Section>

          {/* 4. Notifications */}
          <Section icon={Bell} title={T("notifications_section")}>
            <ToggleRow
              label={T("push_notifications")}
              checked={!!settings.push_notifications}
              onChange={(v) => update("push_notifications", v ? 1 : 0)}
            />
            <ToggleRow
              label={T("email_notifications")}
              checked={!!settings.email_notifications}
              onChange={(v) => update("email_notifications", v ? 1 : 0)}
            />
          </Section>

          {/* 5. Display */}
          <Section icon={Code} title={T("display")}>
            <ToggleRow
              label={T("compact_mode")}
              checked={!!settings.compact_mode}
              onChange={(v) => update("compact_mode", v ? 1 : 0)}
            />
            <ToggleRow
              label={T("show_line_numbers")}
              checked={!!settings.show_line_numbers}
              onChange={(v) => update("show_line_numbers", v ? 1 : 0)}
            />
          </Section>

          {/* Sign out */}
          <div className="border-t border-[var(--color-border-muted)] p-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-subtle)]"
            >
              <LogOut size={16} />
              {T("sign_out")}
            </button>
          </div>
        </div>
      </div>

      {show2FA && (
        <TwoFactorSetup
          onClose={() => setShow2FA(false)}
          onEnabled={() => setTwoFAEnabled(true)}
        />
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="border-b border-[var(--color-border-muted)] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
        <Icon size={12} />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SelectRow({ label, value, onChange, options, disabled, lang }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-sm", disabled && "opacity-50")}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "h-8 min-w-[110px] rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-2 text-sm outline-none focus:border-[var(--color-accent-fg)]",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span className="text-sm">{label}</span>
      <span
        className={cn(
          "relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--color-accent-emphasis)]" : "bg-[var(--color-border-default)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

function ActionRow({ icon: Icon, label, onClick, lang }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-sm hover:bg-[var(--color-canvas-subtle)]"
    >
      <span className="flex items-center gap-2">
        {Icon && <Icon size={16} />}
        {label}
      </span>
      <ChevronRight size={16} className={cn("text-[var(--color-fg-muted)]", lang === "ar" && "rtl-flip")} />
    </button>
  );
}
