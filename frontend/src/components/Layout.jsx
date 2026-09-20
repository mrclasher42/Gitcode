import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { useAuth } from "../contexts/AuthContext";

export function Layout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-[var(--color-fg-muted)]">
        Loading...
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <Header user={user} />
      <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
