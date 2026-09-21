import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Book, Globe, Lock, Star, Users } from "lucide-react";
import { formatCount } from "../lib/format";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { cn } from "../lib/cn";
import { AvatarEditor } from "../components/AvatarEditor";
import { UserAvatar } from "../components/UserAvatar";

function avatarColor(name) {
  const colors = ["#0969da","#1a7f37","#bf3989","#8250df","#cf222e","#bc4c00","#0d9488","#6e40c9"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

function Avatar({ name, size = 64, url }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = name ? name[0].toUpperCase() : "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: avatarColor(name || "x"), fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

export function UserProfile() {
  const { t } = useSettings();
  const { username } = useParams();
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "repos";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  function loadUser() {
    api.user(username)
      .then((d) => {
        setData(d);
        setBio(d.user.bio || "");
        setLocation(d.user.location || "");
        setWebsite(d.user.website || "");
      })
      .catch(() => setError("User not found."));
  }

  useEffect(loadUser, [username]);

  useEffect(() => {
    if (!data) return;
    if (tab === "repos" || tab === "starred") {
      setList([]);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    setList([]);
    fetch(`/api/users/${username}/${tab}`)
      .then((r) => r.json())
      .then((d) => setList(d.followers || d.following || []))
      .catch(() => setList([]))
      .finally(() => setListLoading(false));
  }, [data, tab, username]);

  function changeTab(t) {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next);
  }

  async function toggleFollow() {
    if (!me) return;
    try {
      if (data.is_following) {
        await api.unfollowUser(username);
      } else {
        await api.followUser(username);
      }
      loadUser();
    } catch (e) {
      alert("Failed.");
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      let w = (website || "").trim();
      if (w && !/^https?:\/\//i.test(w)) w = "http://" + w;
      await api.updateProfile({ bio, location, website: w });
      setEditing(false);
      loadUser();
    } catch (e) {
      alert("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function changeUsername() {
    if (!newUsername || newUsername === data?.user.username) return;
    try {
      const r = await fetch("/api/users/me/username", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      window.location.href = "/" + d.user.username;
    } catch (e) {
      alert(e.message);
    }
  }

  async function uploadAvatar(file) {
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/users/me/avatar", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
      // Re-fetch full user data
      const fresh = await api.user(username);
      setData(fresh);
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
        {error}
      </div>
    );
  }
  if (!data) return <p className="text-[var(--color-fg-muted)]">Loading...</p>;

  const u = data.user;
  const isSelf = data.is_self;
  const showRepos = tab === "repos" ? data.repos : data.starred || [];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 border-b border-[var(--color-border-muted)] pb-4 sm:flex-row">
        <UserAvatar user={u} size={96} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-normal">{u.username}</h1>
            {isSelf ? (
              <button
                onClick={() => setEditing((v) => !v)}
                className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 py-1 text-sm hover:bg-[var(--color-btn-hover-bg)]"
              >
                {editing ? "Cancel" : "Edit profile"}
              </button>
            ) : me ? (
              <button
                onClick={toggleFollow}
                className={cn(
                  "rounded-md border px-3 py-1 text-sm",
                  data.is_following
                    ? "border-[var(--color-border-default)] bg-[var(--color-btn-bg)]"
                    : "border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] text-[var(--color-btn-primary-fg)]"
                )}
              >
                {data.is_following ? "Unfollow" : "Follow"}
              </button>
            ) : null}
          </div>

          {editing ? (
            <div className="mt-3 space-y-3">
              {uploadError && (
                <div className="rounded-md border border-[var(--color-danger-emphasis)] bg-[var(--color-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
                  {uploadError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => e.target.files[0] && setAvatarFile(e.target.files[0])}
                  className="block text-sm"
                />
                {uploading && <p className="mt-1 text-xs text-[var(--color-fg-muted)]">Uploading...</p>}
                <p className="mt-1 text-xs text-[var(--color-fg-muted)]">PNG, JPG, GIF, WEBP. Max 2MB.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder={u.username}
                    className="h-8 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={changeUsername}
                    disabled={!newUsername || newUsername === u.username}
                    className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Change
                  </button>
                </div>
              </div>

              <hr className="border-[var(--color-border-muted)]" />

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Bio</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself"
                  className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, Country"
                  className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Website</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="example.com"
                  className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-3 text-sm"
                />
              </div>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-4 py-1.5 text-sm text-[var(--color-btn-primary-fg)] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </div>
          ) : (
            <>
              {u.bio && <p className="mt-1 text-sm">{u.bio}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--color-fg-muted)]">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  <Link to={`/${u.username}?tab=followers`} className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent-fg)]">
                    <b className="text-[var(--color-fg-default)]">{formatCount(data.followers)}</b> followers
                  </Link>
                  ·
                  <Link to={`/${u.username}?tab=following`} className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent-fg)]">
                    <b className="text-[var(--color-fg-default)]">{formatCount(data.following_count)}</b> following
                  </Link>
                </span>
                {u.location && <span>{u.location}</span>}
                {u.website && /^https?:\/\//i.test(u.website) && (
                  <a
                    href={u.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-accent-fg)]"
                  >
                    {u.website.replace(/^https?:\/\//i, "")}
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="no-scrollbar mb-3 flex gap-1 overflow-x-auto border-b border-[var(--color-border-muted)]">
        {[
          ["repos", `${t("your_repos")} (${formatCount(data.repos.length)})`],
          ["starred", `${t("starred_tab")} (${formatCount((data.starred || []).length)})`],
          ["followers", `Followers (${formatCount(data.followers)})`],
          ["following", `Following (${formatCount(data.following_count)})`],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => changeTab(id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-1.5 text-sm",
              tab === id
                ? "border-[var(--color-accent-fg)] font-semibold text-[var(--color-fg-default)]"
                : "border-transparent text-[var(--color-fg-muted)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "repos" || tab === "starred" ? (
        showRepos.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nothing here.</p>
        ) : (
          <ul className="space-y-3">
            {showRepos.map((r) => (
              <li key={r.id} className="rounded-md border border-[var(--color-border-default)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {tab === "starred" ? <Star size={16} className="text-[var(--color-attention-fg)]" /> : <Book size={16} className="text-[var(--color-fg-muted)]" />}
                  <Link to={`/${r.owner_username}/${r.name}`} className="font-semibold text-[var(--color-accent-fg)]">
                    {r.owner_username}/{r.name}
                  </Link>
                  <span className="rounded-full border border-[var(--color-border-default)] px-2 py-0.5 text-xs text-[var(--color-fg-muted)]">
                    {r.is_private ? <><Lock size={10} className="mr-1 inline" /> Private</> : <><Globe size={10} className="mr-1 inline" /> Public</>}
                  </span>
                </div>
                {r.description && <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{r.description}</p>}
              </li>
            ))}
          </ul>
        )
      ) : listLoading ? (
        <p className="text-[var(--color-fg-muted)]">Loading...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">Nobody yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-muted)] rounded-md border border-[var(--color-border-default)]">
          {list.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar user={x} size={32} />
              <Link to={`/${x.username}`} className="font-semibold text-[var(--color-accent-fg)]">
                {x.username}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {avatarFile && (
        <AvatarEditor
          file={avatarFile}
          onCancel={() => setAvatarFile(null)}
          onSave={async (blob) => {
            await uploadAvatar(new File([blob], "avatar.png", { type: "image/png" }));
            setAvatarFile(null);
          }}
        />
      )}
    </div>
  );
}
