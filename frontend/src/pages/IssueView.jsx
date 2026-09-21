import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { CircleDot, CheckCircle2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/Button";

export function IssueView() {
  const { owner, name, number } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/repos/${owner}/${name}/issues/${number}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setIssue(d.issue);
        setComments(d.comments || []);
      })
      .catch(() => setError("Issue not found."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [owner, name, number]);

  async function submitComment(e) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/repos/${owner}/${name}/issues/${number}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      if (!res.ok) throw new Error("Failed");
      setCommentBody("");
      load();
    } catch (err) {
      alert("Comment failed.");
    } finally {
      setPosting(false);
    }
  }

  async function toggleState() {
    const newState = issue.state === "open" ? "closed" : "open";
    try {
      const res = await fetch(`/api/repos/${owner}/${name}/issues/${number}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      });
      if (!res.ok) throw new Error("Failed");
      load();
    } catch (err) {
      alert("Failed to update state.");
    }
  }

  if (loading) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;
  if (error) {
    return (
      <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
        {error}
      </div>
    );
  }

  const Icon = issue.state === "open" ? CircleDot : CheckCircle2;
  const iconColor = issue.state === "open"
    ? "text-[var(--color-success-fg)]"
    : "text-[var(--color-done)]";

  return (
    <div>
      <div className="mb-4 border-b border-[var(--color-border-muted)] pb-3">
        <Link
          to={`/${owner}/${name}/issues`}
          className="text-sm text-[var(--color-accent-fg)]"
        >
          ← All issues
        </Link>
        <h1 className="mt-2 text-xl font-normal">
          {issue.title}{" "}
          <span className="text-[var(--color-fg-muted)]">#{issue.number}</span>
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Icon size={16} className={iconColor} />
          <span className={issue.state === "open" ? "text-[var(--color-success-fg)]" : "text-[var(--color-done)]"}>
            {issue.state}
          </span>
          <span className="text-[var(--color-fg-muted)]">
            {issue.author_username} opened this on{" "}
            {new Date(issue.created_at * 1000).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Issue body */}
      <div className="mb-4 rounded-md border border-[var(--color-border-default)]">
        <div className="border-b border-[var(--color-border-muted)] bg-[var(--color-canvas-subtle)] px-3 py-2 text-sm">
          <span className="font-semibold">{issue.author_username}</span>
          <span className="ml-2 text-xs text-[var(--color-fg-muted)]">
            {new Date(issue.created_at * 1000).toLocaleString()}
          </span>
        </div>
        <div className="whitespace-pre-wrap p-3 text-sm">
          {issue.body || <span className="text-[var(--color-fg-muted)]">No description.</span>}
        </div>
      </div>

      {/* Comments */}
      {comments.map((c) => (
        <div key={c.id} className="mb-3 rounded-md border border-[var(--color-border-default)]">
          <div className="border-b border-[var(--color-border-muted)] bg-[var(--color-canvas-subtle)] px-3 py-2 text-sm">
            <span className="font-semibold">{c.author_username}</span>
            <span className="ml-2 text-xs text-[var(--color-fg-muted)]">
              {new Date(c.created_at * 1000).toLocaleString()}
            </span>
          </div>
          <div className="whitespace-pre-wrap p-3 text-sm">{c.body}</div>
        </div>
      ))}

      {/* Actions */}
      {user && (
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={toggleState} variant={issue.state === "open" ? "default" : "primary"}>
            {issue.state === "open" ? "Close issue" : "Reopen issue"}
          </Button>
        </div>
      )}

      {/* Add comment */}
      {user && issue.state === "open" && (
        <form onSubmit={submitComment} className="mt-6">
          <h2 className="mb-2 text-base font-semibold">Add a comment</h2>
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={5}
            placeholder="Leave a comment"
            className="mb-3 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-3 text-sm outline-none focus:border-[var(--color-accent-fg)]"
          />
          <Button type="submit" variant="primary" disabled={posting || !commentBody.trim()}>
            {posting ? "Posting..." : "Comment"}
          </Button>
        </form>
      )}
    </div>
  );
}
