import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

export function UserProfile() {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.user(username)
      .then(setData)
      .catch(() => setError("User not found."));
  }, [username]);

  if (error) return <div className="text-[var(--color-fg-muted)]">{error}</div>;
  if (!data) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-normal">{data.user.username}</h1>
      <h2 className="mb-2 text-base font-semibold">Repositories</h2>
      {data.repos.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">No repositories.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-muted)]">
          {data.repos.map((r) => (
            <li key={r.id} className="py-2">
              <Link
                to={`/${data.user.username}/${r.name}`}
                className="font-semibold text-[var(--color-accent-fg)]"
              >
                {r.name}
              </Link>
              {r.description && (
                <p className="text-sm text-[var(--color-fg-muted)]">{r.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
