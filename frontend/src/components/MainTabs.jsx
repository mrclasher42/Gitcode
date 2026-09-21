import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/cn";
import { useSettings } from "../contexts/SettingsContext";

const TABS = [
  { id: "home",     key: "home",     path: "/" },
  { id: "posts",    key: "posts",    path: "/posts" },
];

export function MainTabs() {
  const { pathname } = useLocation();
  const { t } = useSettings();

  let active = null;
  if (pathname === "/" || pathname === "/explore") active = "home";
  else if (pathname.startsWith("/posts")) active = "posts";

  return (
    <div className="border-b border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)]">
      <nav className="mx-auto flex max-w-[1280px] gap-1 no-scrollbar overflow-x-auto px-3 sm:px-4 md:px-8 no-scrollbar">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={cn(
                "shrink-0 border-b-2 px-4 py-2.5 text-sm",
                isActive
                  ? "border-[var(--color-accent-emphasis)] font-semibold text-[var(--color-fg-default)]"
                  : "border-transparent text-[var(--color-fg-muted)] hover:border-[var(--color-border-default)] hover:text-[var(--color-fg-default)]"
              )}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
