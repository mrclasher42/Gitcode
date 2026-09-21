import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { t } from "../lib/i18n";

const SettingsContext = createContext(null);

const DEFAULTS = {
  theme: "system",
  language: "en",
  push_notifications: 1,
  email_notifications: 0,
  default_visibility: "public",
  show_email: 0,
  profile_public: 1,
  compact_mode: 0,
  show_line_numbers: 0,
};

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULTS);
      setLoaded(true);
      return;
    }
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSettings({ ...DEFAULTS, ...d.settings }))
      .catch(() => setSettings(DEFAULTS))
      .finally(() => setLoaded(true));
  }, [user]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.theme || "system";
    let effective = theme;
    if (theme === "system") {
      effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.setAttribute("data-color-mode", effective);
    root.setAttribute("data-theme", effective);
    try { localStorage.setItem("gc-theme", theme); } catch {}
  }, [settings.theme]);

  // Apply language (RTL/LTR) — writes dir & lang to <html> AND localStorage
  useEffect(() => {
    const html = document.documentElement;
    const lang = settings.language || "en";
    html.setAttribute("lang", lang);
    html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    // Persist for pre-render on next load
    try { localStorage.setItem("gc-lang", lang); } catch {}
    try { localStorage.setItem("gc-theme", settings.theme || "system"); } catch {}
  }, [settings.language, settings.theme]);

  // (Editor settings removed)

  // Apply compact mode
  useEffect(() => {
    if (settings.compact_mode) {
      document.body.classList.add("compact");
    } else {
      document.body.classList.remove("compact");
    }
  }, [settings.compact_mode]);

  // Apply line numbers
  useEffect(() => {
    if (settings.show_line_numbers) {
      document.body.classList.add("show-line-numbers");
    } else {
      document.body.classList.remove("show-line-numbers");
    }
  }, [settings.show_line_numbers]);

  async function update(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
    try {
      await fetch("/api/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {}
  }

  return (
    <SettingsContext.Provider value={{ settings, loaded, update, t: (k) => t(settings.language || "en", k) }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
