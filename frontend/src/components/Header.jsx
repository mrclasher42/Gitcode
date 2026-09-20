import { Link, NavLink, useNavigate } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../contexts/AuthContext";

export function Header({ user }) {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const nav = useNavigate();

  async function handleLogout() {
    await logout();
    nav("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)]">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-4 md:px-8">

        {/* Left: logo + Explore (Explore hidden on small) */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <Link
            to="/"
            className="flex items-center gap-1.5 whitespace-nowrap font-mono text-sm font-bold sm:text-base"
          >
            <span className="text-[var(--color-accent-fg)]">{"{ }"}</span>
            <span>GitCode</span>
          </Link>
          <NavLink
            to="/explore"
            className="hidden text-sm font-medium hover:text-[var(--color-accent-fg)] sm:inline"
          >
            Explore
          </NavLink>
        </div>

        {/* Right: actions */}
        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <IconButton onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>

          {user ? (
            <>
              <Button as={Link} to="/new" size="sm" className="hidden xs:inline-flex sm:inline-flex">
                New
              </Button>
              <Button
                as={Link}
                to={`/${user.username}`}
                size="sm"
                className="max-w-[100px] truncate sm:max-w-none"
              >
                {user.username}
              </Button>
              <Button onClick={handleLogout} size="sm">
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button as={Link} to="/login" size="sm">Sign in</Button>
              <Button as={Link} to="/signup" size="sm" variant="primary">Sign up</Button>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
