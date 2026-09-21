import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Moon, Sun, Bell, ChevronDown, User, Settings as SettingsIcon, LogOut, Key } from "lucide-react";
import { IconButton } from "./IconButton";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../contexts/AuthContext";
import { UserAvatar } from "./UserAvatar";
import { SettingsDrawer } from "./SettingsDrawer";

export function Header({ user }) {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Load unread notification count
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    function load() {
      fetch("/api/notifications/count", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setUnread(d.unread || 0);
        })
        .catch(() => {});
    }
    load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    nav("/");
  }

  function submitSearch(e) {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (q) nav("/search?q=" + encodeURIComponent(q));
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)]">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-4 md:px-8">

        {/* Left: logo + nav */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <Link
            to="/"
            className="flex items-center gap-1.5 whitespace-nowrap font-mono text-sm font-bold sm:text-base"
          >
            <span className="text-[var(--color-accent-fg)]">{"{ }"}</span>
            <span>GitCode</span>
          </Link>
        </div>

        {/* Middle: search */}
        <form onSubmit={submitSearch} className="hidden max-w-md flex-1 md:flex">
          <input
            type="search"
            name="q"
            placeholder="Search..."
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
        </form>

        {/* Right: actions */}
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">

          {/* Settings */}
          {user && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-fg-default)] hover:bg-[var(--color-btn-hover-bg)]"
              aria-label="Settings"
            >
              <SettingsIcon size={16} />
            </button>
          )}

          {/* Notifications */}
          {user && (
            <Link
              to="/notifications"
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-fg-default)] hover:bg-[var(--color-btn-hover-bg)]"
              aria-label="Notifications"
            >
              <Bell size={16} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-danger-emphasis)] px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}

          {/* Theme toggle */}
          <IconButton onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>

          {/* Account */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-1.5 hover:bg-[var(--color-btn-hover-bg)]"
              >
                <UserAvatar user={user} size={24} />
                <span className="hidden max-w-[100px] truncate text-sm font-medium sm:inline">
                  {user.username}
                </span>
                <ChevronDown size={12} className="text-[var(--color-fg-muted)]" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-md border border-[var(--color-border-default)] py-1 shadow-xl"
                  style={{ backgroundColor: "var(--color-canvas-default, #161b22)" }}
                >
                  <div className="border-b border-[var(--color-border-muted)] px-3 py-2">
                    <div className="text-sm font-semibold">{user.username}</div>
                    {user.email && (
                      <div className="text-xs text-[var(--color-fg-muted)]">{user.email}</div>
                    )}
                  </div>

                  <Link
                    to={`/${user.username}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-canvas-subtle)]"
                  >
                    <User size={14} />
                    Your profile
                  </Link>

                  <Link
                    to="/settings/tokens"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-canvas-subtle)]"
                  >
                    <Key size={14} />
                    API tokens
                  </Link>

                  <div className="my-1 border-t border-[var(--color-border-muted)]" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-canvas-subtle)]"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden h-8 items-center rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 text-sm hover:bg-[var(--color-btn-hover-bg)] sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="inline-flex h-8 items-center rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-3 text-sm font-medium text-[var(--color-btn-primary-fg)] hover:bg-[var(--color-btn-primary-hover-bg)]"
              >
                Sign up
              </Link>
            </>
          )}

        </div>
      </div>

      {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
