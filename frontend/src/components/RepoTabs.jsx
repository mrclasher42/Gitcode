import { Link, useLocation, useParams } from "react-router-dom";
import { cn } from "../lib/cn";
import { useSettings } from "../contexts/SettingsContext";

const TABS = [
  { id: "code",         label: "code",         path: "" },
  { id: "issues",       label: "issues",       path: "/issues" },
  { id: "commits",      label: "commits",      path: "/commits" },
  { id: "branches",     label: "branches",     path: "/branches" },
  { id: "releases",     label: "releases",     path: "/releases" },
  { id: "forks",        label: "forks_only",        path: "/forks" },
  { id: "contributors", label: "contributors", path: "/contributors" },
  { id: "search",       label: "find",         path: "/search" },
];

export function RepoTabs() {
  const { owner, name } = useParams();
  const { t } = useSettings();
  const { pathname } = useLocation();
  const base = `/${owner}/${name}`;

  let active = "code";
  if (pathname.startsWith(base + "/issues")) active = "issues";
  else if (pathname.startsWith(base + "/commits") || pathname.startsWith(base + "/commit/")) active = "commits";
  else if (pathname.startsWith(base + "/branches")) active = "branches";
  else if (pathname.startsWith(base + "/releases")) active = "releases";
  else if (pathname.startsWith(base + "/forks")) active = "forks";
  else if (pathname.startsWith(base + "/contributors")) active = "contributors";
  else if (pathname.startsWith(base + "/search")) active = "search";

  return (
    <div className="border-b border-[var(--color-border-default)]">
      <nav className="no-scrollbar flex gap-1 overflow-x-auto">
        {TABS.map((item) => {
          const isActive = item.id === active;
          return (
            <Link
              key={item.id}
              to={base + item.path}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm",
                isActive
                  ? "border-[var(--color-accent-emphasis)] font-semibold text-[var(--color-fg-default)]"
                  : "border-transparent text-[var(--color-fg-muted)] hover:border-[var(--color-border-default)] hover:text-[var(--color-fg-default)]"
              )}
            >
              {t(item.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
