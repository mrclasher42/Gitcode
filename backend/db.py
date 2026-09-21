"""SQLite schema and queries for GitCode."""
import os
import sqlite3
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "..", "data", "gitcode.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email         TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    bio           TEXT DEFAULT '',
    location      TEXT DEFAULT '',
    website       TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    user_agent  TEXT DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id       INTEGER NOT NULL,
    name           TEXT NOT NULL COLLATE NOCASE,
    description    TEXT DEFAULT '',
    is_private     INTEGER DEFAULT 0,
    default_branch TEXT DEFAULT 'main',
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    UNIQUE(owner_id, name),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stars (
    user_id    INTEGER NOT NULL,
    repo_id    INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, repo_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issues (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id    INTEGER NOT NULL,
    author_id  INTEGER NOT NULL,
    number     INTEGER NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT DEFAULT '',
    state      TEXT DEFAULT 'open',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(repo_id, number),
    FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issue_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id   INTEGER NOT NULL,
    author_id  INTEGER NOT NULL,
    body       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_repos_owner   ON repos(owner_id);
CREATE INDEX IF NOT EXISTS idx_issues_repo   ON issues(repo_id);
CREATE INDEX IF NOT EXISTS idx_comments_issue ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);
"""


def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def now():
    return int(time.time())



def create_user(username, email, password_hash, salt):
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (username, email, password_hash, salt, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (username, email, password_hash, salt, now()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_user_by_username(username):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id):
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()



def create_session(token, user_id, expires_at, user_agent=""):
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at, expires_at, user_agent) "
            "VALUES (?, ?, ?, ?, ?)",
            (token, user_id, now(), expires_at, user_agent),
        )
        conn.commit()
    finally:
        conn.close()


def get_session(token):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM sessions WHERE token = ? AND expires_at > ?",
            (token, now()),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete_session(token):
    conn = get_conn()
    try:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
    finally:
        conn.close()



def create_repo(owner_id, name, description="", is_private=0, default_branch="main"):
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO repos (owner_id, name, description, is_private, "
            "default_branch, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (owner_id, name, description, is_private, default_branch, now(), now()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_repo(owner_username, name):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT r.*, u.username AS owner_username FROM repos r "
            "JOIN users u ON u.id = r.owner_id "
            "WHERE u.username = ? COLLATE NOCASE AND r.name = ? COLLATE NOCASE",
            (owner_username, name),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_repos_by_owner(owner_id, include_private=False):
    conn = get_conn()
    try:
        sql = ("SELECT r.*, u.username AS owner_username FROM repos r "
               "JOIN users u ON u.id = r.owner_id "
               "WHERE r.owner_id = ?")
        if not include_private:
            sql += " AND r.is_private = 0"
        sql += " ORDER BY r.updated_at DESC"
        rows = conn.execute(sql, (owner_id,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def list_public_repos(limit=50):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT r.*, u.username AS owner_username FROM repos r "
            "JOIN users u ON u.id = r.owner_id "
            "WHERE r.is_private = 0 "
            "ORDER BY r.updated_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_repo_timestamp(repo_id):
    conn = get_conn()
    try:
        conn.execute("UPDATE repos SET updated_at = ? WHERE id = ?", (now(), repo_id))
        conn.commit()
    finally:
        conn.close()


def delete_repo(repo_id):
    conn = get_conn()
    try:
        conn.execute("DELETE FROM repos WHERE id = ?", (repo_id,))
        conn.commit()
    finally:
        conn.close()



def get_repo_by_id(repo_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT r.*, u.username AS owner_username FROM repos r "
            "JOIN users u ON u.id = r.owner_id WHERE r.id = ?",
            (repo_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_fork(owner_id, name, description, is_private, parent_id):
    """Create a fork of an existing repo."""
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO repos (owner_id, name, description, is_private, "
            "default_branch, created_at, updated_at, parent_id, forked_at) "
            "VALUES (?, ?, ?, ?, 'main', ?, ?, ?, ?)",
            (owner_id, name, description, is_private,
             now(), now(), parent_id, now()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def list_forks(parent_id):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT r.*, u.username AS owner_username FROM repos r "
            "JOIN users u ON u.id = r.owner_id "
            "WHERE r.parent_id = ? ORDER BY r.created_at DESC",
            (parent_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_repo(repo_id, fields):
    """Update allowed fields: description, is_private, default_branch."""
    allowed = {}
    if "description" in fields:
        allowed["description"] = str(fields["description"])
    if "private" in fields:
        allowed["is_private"] = 1 if fields["private"] else 0
    if "default_branch" in fields:
        allowed["default_branch"] = str(fields["default_branch"])
    if not allowed:
        return False
    allowed["updated_at"] = now()

    cols = ", ".join("%s = ?" % k for k in allowed.keys())
    vals = list(allowed.values()) + [repo_id]
    conn = get_conn()
    try:
        conn.execute("UPDATE repos SET %s WHERE id = ?" % cols, vals)
        conn.commit()
        return True
    finally:
        conn.close()



def next_issue_number(repo_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT COALESCE(MAX(number), 0) + 1 AS n FROM issues WHERE repo_id = ?",
            (repo_id,),
        ).fetchone()
        return row["n"]
    finally:
        conn.close()


def create_issue(repo_id, author_id, title, body):
    conn = get_conn()
    try:
        number = next_issue_number(repo_id)
        cur = conn.execute(
            "INSERT INTO issues (repo_id, author_id, number, title, body, state, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, 'open', ?, ?)",
            (repo_id, author_id, number, title, body, now(), now()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def list_issues(repo_id, state="open"):
    conn = get_conn()
    try:
        sql = (
            "SELECT i.*, u.username AS author_username "
            "FROM issues i JOIN users u ON u.id = i.author_id "
            "WHERE i.repo_id = ?"
        )
        params = [repo_id]
        if state in ("open", "closed"):
            sql += " AND i.state = ?"
            params.append(state)
        # state="all" -> no filter
        sql += " ORDER BY i.created_at DESC"
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_issue(repo_id, number):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT i.*, u.username AS author_username "
            "FROM issues i JOIN users u ON u.id = i.author_id "
            "WHERE i.repo_id = ? AND i.number = ?",
            (repo_id, number),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_issue_state(issue_id, state):
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE issues SET state = ?, updated_at = ? WHERE id = ?",
            (state, now(), issue_id),
        )
        conn.commit()
    finally:
        conn.close()


def add_issue_comment(issue_id, author_id, body):
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO issue_comments (issue_id, author_id, body, created_at) "
            "VALUES (?, ?, ?, ?)",
            (issue_id, author_id, body, now()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def list_issue_comments(issue_id):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT c.*, u.username AS author_username "
            "FROM issue_comments c JOIN users u ON u.id = c.author_id "
            "WHERE c.issue_id = ? ORDER BY c.created_at ASC",
            (issue_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def count_issues(repo_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM issues WHERE repo_id = ? AND state = 'open'",
            (repo_id,),
        ).fetchone()
        return row["n"]
    finally:
        conn.close()



def is_starred(user_id, repo_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM stars WHERE user_id = ? AND repo_id = ?",
            (user_id, repo_id),
        ).fetchone()
        return bool(row)
    finally:
        conn.close()


def toggle_star(user_id, repo_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM stars WHERE user_id = ? AND repo_id = ?",
            (user_id, repo_id),
        ).fetchone()
        if row:
            conn.execute(
                "DELETE FROM stars WHERE user_id = ? AND repo_id = ?",
                (user_id, repo_id),
            )
            starred = False
        else:
            conn.execute(
                "INSERT INTO stars (user_id, repo_id, created_at) VALUES (?, ?, ?)",
                (user_id, repo_id, now()),
            )
            starred = True
        conn.commit()
        return starred
    finally:
        conn.close()


def count_stars(repo_id):
    conn = get_conn()
    try:
        real = conn.execute(
            "SELECT COUNT(*) AS n FROM stars WHERE repo_id = ?", (repo_id,)
        ).fetchone()["n"]
        row = conn.execute(
            "SELECT extra_stars FROM repos WHERE id = ?", (repo_id,)
        ).fetchone()
        extra = (row["extra_stars"] or 0) if row else 0
        return real + extra
    finally:
        conn.close()


def list_starred_repos(user_id):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT r.*, u.username AS owner_username FROM stars s "
            "JOIN repos r ON r.id = s.repo_id "
            "JOIN users u ON u.id = r.owner_id "
            "WHERE s.user_id = ? ORDER BY s.created_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()



def is_watching(user_id, repo_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM watches WHERE user_id = ? AND repo_id = ?",
            (user_id, repo_id),
        ).fetchone()
        return bool(row)
    finally:
        conn.close()


def toggle_watch(user_id, repo_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM watches WHERE user_id = ? AND repo_id = ?",
            (user_id, repo_id),
        ).fetchone()
        if row:
            conn.execute(
                "DELETE FROM watches WHERE user_id = ? AND repo_id = ?",
                (user_id, repo_id),
            )
            watching = False
        else:
            conn.execute(
                "INSERT INTO watches (user_id, repo_id, created_at) VALUES (?, ?, ?)",
                (user_id, repo_id, now()),
            )
            watching = True
        conn.commit()
        return watching
    finally:
        conn.close()


def count_watches(repo_id):
    conn = get_conn()
    try:
        real = conn.execute(
            "SELECT COUNT(*) AS n FROM watches WHERE repo_id = ?", (repo_id,)
        ).fetchone()["n"]
        row = conn.execute(
            "SELECT extra_watches FROM repos WHERE id = ?", (repo_id,)
        ).fetchone()
        extra = (row["extra_watches"] or 0) if row else 0
        return real + extra
    finally:
        conn.close()


def count_forks(repo_id):
    conn = get_conn()
    try:
        real = conn.execute(
            "SELECT COUNT(*) AS n FROM repos WHERE parent_id = ?", (repo_id,)
        ).fetchone()["n"]
        row = conn.execute(
            "SELECT extra_forks FROM repos WHERE id = ?", (repo_id,)
        ).fetchone()
        extra = (row["extra_forks"] or 0) if row else 0
        return real + extra
    finally:
        conn.close()



def log_activity(user_id, repo_id, kind, detail=""):
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO activities (user_id, repo_id, kind, detail, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, repo_id, kind, detail, now()),
        )
        conn.commit()
    finally:
        conn.close()


def list_activities(limit=30, user_id=None):
    conn = get_conn()
    try:
        sql = (
            "SELECT a.*, u.username AS username, u.avatar AS user_avatar, "
            "r.name AS repo_name, "
            "ru.username AS repo_owner, ru.avatar AS repo_owner_avatar "
            "FROM activities a "
            "JOIN users u ON u.id = a.user_id "
            "LEFT JOIN repos r ON r.id = a.repo_id "
            "LEFT JOIN users ru ON ru.id = r.owner_id "
        )
        params = []
        if user_id:
            sql += " WHERE a.user_id = ? "
            params.append(user_id)
        sql += " ORDER BY a.created_at DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()



def is_following(follower_id, followed_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?",
            (follower_id, followed_id),
        ).fetchone()
        return bool(row)
    finally:
        conn.close()


def follow(follower_id, followed_id):
    conn = get_conn()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO follows (follower_id, followed_id, created_at) "
            "VALUES (?, ?, ?)",
            (follower_id, followed_id, now()),
        )
        conn.commit()
    finally:
        conn.close()


def unfollow(follower_id, followed_id):
    conn = get_conn()
    try:
        conn.execute(
            "DELETE FROM follows WHERE follower_id = ? AND followed_id = ?",
            (follower_id, followed_id),
        )
        conn.commit()
    finally:
        conn.close()


def count_followers(user_id):
    conn = get_conn()
    try:
        real = conn.execute(
            "SELECT COUNT(*) AS n FROM follows WHERE followed_id = ?", (user_id,)
        ).fetchone()["n"]
        row = conn.execute(
            "SELECT extra_followers FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        extra = (row["extra_followers"] or 0) if row else 0
        return real + extra
    finally:
        conn.close()


def count_following(user_id):
    conn = get_conn()
    try:
        real = conn.execute(
            "SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?", (user_id,)
        ).fetchone()["n"]
        row = conn.execute(
            "SELECT extra_following FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        extra = (row["extra_following"] or 0) if row else 0
        return real + extra
    finally:
        conn.close()


def list_followers(user_id):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT u.id, u.username, u.bio, u.avatar, f.created_at "
            "FROM follows f JOIN users u ON u.id = f.follower_id "
            "WHERE f.followed_id = ? ORDER BY f.created_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def list_following(user_id):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT u.id, u.username, u.bio, u.avatar, f.created_at "
            "FROM follows f JOIN users u ON u.id = f.followed_id "
            "WHERE f.follower_id = ? ORDER BY f.created_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()



def create_notification(user_id, actor_id, kind, repo_id=None, detail="",
                        target_type="", target_id=None):
    """Don't notify self."""
    if user_id == actor_id:
        return
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO notifications "
            "(user_id, actor_id, kind, repo_id, detail, target_type, target_id, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, actor_id, kind, repo_id, detail, target_type, target_id, now()),
        )
        conn.commit()
    finally:
        conn.close()


def list_notifications(user_id, limit=50, unread_only=False):
    conn = get_conn()
    try:
        sql = (
            "SELECT n.*, a.username AS actor_username, a.avatar AS actor_avatar, "
            "r.name AS repo_name, ru.username AS repo_owner "
            "FROM notifications n "
            "JOIN users a ON a.id = n.actor_id "
            "LEFT JOIN repos r ON r.id = n.repo_id "
            "LEFT JOIN users ru ON ru.id = r.owner_id "
            "WHERE n.user_id = ? "
        )
        params = [user_id]
        if unread_only:
            sql += " AND n.is_read = 0 "
        sql += " ORDER BY n.created_at DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def count_unread_notifications(user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM notifications "
            "WHERE user_id = ? AND is_read = 0",
            (user_id,),
        ).fetchone()
        return row["n"]
    finally:
        conn.close()


def mark_notifications_read(user_id):
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
            (user_id,),
        )
        conn.commit()
    finally:
        conn.close()


def update_user_profile(user_id, bio=None, location=None, website=None):
    conn = get_conn()
    try:
        fields = {}
        if bio is not None:
            fields["bio"] = bio
        if location is not None:
            fields["location"] = location
        if website is not None:
            fields["website"] = website
        if not fields:
            return False
        cols = ", ".join("%s = ?" % k for k in fields.keys())
        vals = list(fields.values()) + [user_id]
        conn.execute("UPDATE users SET %s WHERE id = ?" % cols, vals)
        conn.commit()
        return True
    finally:
        conn.close()


def set_default_branch(repo_id, branch):
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE repos SET default_branch = ?, updated_at = ? WHERE id = ?",
            (branch, now(), repo_id),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def set_avatar(user_id, path):
    conn = get_conn()
    try:
        conn.execute("UPDATE users SET avatar = ? WHERE id = ?", (path, user_id))
        conn.commit()
    finally:
        conn.close()


def update_username(user_id, new_username):
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE users SET username = ? WHERE id = ?",
            (new_username, user_id),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()



def create_token(user_id, token, name, scopes="read", expires_at=None):
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO api_tokens (user_id, token, name, scopes, created_at, expires_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, token, name, scopes, now(), expires_at),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_token(token):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM api_tokens WHERE token = ?", (token,)
        ).fetchone()
        if not row:
            return None
        if row["expires_at"] and row["expires_at"] < now():
            return None
        conn.execute(
            "UPDATE api_tokens SET last_used = ? WHERE id = ?",
            (now(), row["id"]),
        )
        conn.commit()
        return dict(row)
    finally:
        conn.close()


def list_tokens(user_id):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, name, scopes, created_at, last_used, expires_at "
            "FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def delete_token(user_id, token_id):
    conn = get_conn()
    try:
        conn.execute(
            "DELETE FROM api_tokens WHERE id = ? AND user_id = ?",
            (token_id, user_id),
        )
        conn.commit()
    finally:
        conn.close()



def create_release(repo_id, author_id, tag, name, body, is_draft=False, is_prerelease=False):
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO releases (repo_id, author_id, tag, name, body, is_draft, is_prerelease, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (repo_id, author_id, tag, name, body,
             1 if is_draft else 0, 1 if is_prerelease else 0,
             now(), now()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def list_releases(repo_id, include_drafts=False):
    conn = get_conn()
    try:
        sql = (
            "SELECT r.*, u.username AS author_username "
            "FROM releases r JOIN users u ON u.id = r.author_id "
            "WHERE r.repo_id = ?"
        )
        params = [repo_id]
        if not include_drafts:
            sql += " AND r.is_draft = 0"
        sql += " ORDER BY r.created_at DESC"
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_release(repo_id, release_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT r.*, u.username AS author_username "
            "FROM releases r JOIN users u ON u.id = r.author_id "
            "WHERE r.repo_id = ? AND r.id = ?",
            (repo_id, release_id),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete_release(repo_id, release_id):
    conn = get_conn()
    try:
        conn.execute(
            "DELETE FROM releases WHERE repo_id = ? AND id = ?",
            (repo_id, release_id),
        )
        conn.commit()
    finally:
        conn.close()


def add_release_asset(release_id, filename, content_type, size, path):
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO release_assets (release_id, filename, content_type, size, path, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (release_id, filename, content_type, size, path, now()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def list_release_assets(release_id):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, filename, content_type, size, downloads, created_at "
            "FROM release_assets WHERE release_id = ? ORDER BY created_at ASC",
            (release_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_release_asset(asset_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM release_assets WHERE id = ?", (asset_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def increment_asset_downloads(asset_id):
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE release_assets SET downloads = downloads + 1 WHERE id = ?",
            (asset_id,),
        )
        conn.commit()
    finally:
        conn.close()



def generate_slug(title, post_id=None):
    import re
    base = (title or "").strip().lower()
    base = re.sub(r"[^a-z0-9\s-]", "", base)
    base = re.sub(r"\s+", "-", base)
    base = re.sub(r"-+", "-", base).strip("-")
    if not base:
        base = "post"
    return base[:80]


def unique_slug(base):
    conn = get_conn()
    try:
        slug = base
        i = 1
        while True:
            row = conn.execute("SELECT 1 FROM posts WHERE slug = ?", (slug,)).fetchone()
            if not row:
                return slug
            i += 1
            slug = "%s-%d" % (base, i)
    finally:
        conn.close()


def create_post(author_id, title, body, kind="short", cover="", tags="", is_draft=False):
    base = generate_slug(title or body[:40])
    slug = unique_slug(base)
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO posts (author_id, slug, title, body, kind, cover, tags, is_draft, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (author_id, slug, title, body, kind, cover, tags, 1 if is_draft else 0, now(), now()),
        )
        conn.commit()
        return cur.lastrowid, slug
    finally:
        conn.close()


def get_post_by_slug(slug):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT p.*, u.username AS author_username, u.avatar AS author_avatar "
            "FROM posts p JOIN users u ON u.id = p.author_id "
            "WHERE p.slug = ?",
            (slug,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_posts(limit=30, offset=0, author_id=None, include_drafts=False, viewer_id=None):
    conn = get_conn()
    try:
        sql = (
            "SELECT p.*, u.username AS author_username, u.avatar AS author_avatar, "
            "((SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) + COALESCE(p.extra_likes, 0)) AS real_likes, "
            "((SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) + COALESCE(p.extra_comments, 0)) AS real_comments, "
            "((SELECT COUNT(*) FROM post_bookmarks WHERE post_id = p.id) + COALESCE(p.extra_bookmarks, 0)) AS real_bookmarks, "
            "(COALESCE(p.views, 0) + COALESCE(p.extra_views, 0)) AS real_views "
            "FROM posts p JOIN users u ON u.id = p.author_id "
        )
        params = []
        conds = []
        if not include_drafts:
            conds.append("p.is_draft = 0")
        if author_id:
            conds.append("p.author_id = ?")
            params.append(author_id)
            if viewer_id != author_id:
                conds.append("p.visibility = 'public'")
        else:
            if viewer_id:
                conds.append(
                    "(p.visibility = 'public' OR "
                    "(p.visibility = 'followers' AND EXISTS ("
                    "SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = p.author_id"
                    ")))"
                )
                params.append(viewer_id)
            else:
                conds.append("p.visibility = 'public'")
        if conds:
            sql += " WHERE " + " AND ".join(conds)
        sql += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = conn.execute(sql, params).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["likes"] = d.pop("real_likes", 0)
            d["comments"] = d.pop("real_comments", 0)
            d["bookmarks"] = d.pop("real_bookmarks", 0)
            d["views"] = d.pop("real_views", 0)
            result.append(d)
        return result
    finally:
        conn.close()



def list_following_posts(user_id, limit=30, offset=0):
    """Posts from users this user follows."""
    conn = get_conn()
    try:
        sql = (
            "SELECT p.*, u.username AS author_username, u.avatar AS author_avatar, "
            "((SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) + COALESCE(p.extra_likes, 0)) AS likes, "
            "((SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) + COALESCE(p.extra_comments, 0)) AS comments, "
            "((SELECT COUNT(*) FROM post_bookmarks WHERE post_id = p.id) + COALESCE(p.extra_bookmarks, 0)) AS bookmarks, "
            "(COALESCE(p.views, 0) + COALESCE(p.extra_views, 0)) AS views_total "
            "FROM posts p "
            "JOIN users u ON u.id = p.author_id "
            "JOIN follows f ON f.followed_id = p.author_id "
            "WHERE f.follower_id = ? AND p.is_draft = 0 "
            "AND p.visibility IN ('public', 'followers') "
            "ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
        )
        rows = conn.execute(sql, (user_id, limit, offset)).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["views"] = d.pop("views_total", 0)
            result.append(d)
        return result
    finally:
        conn.close()


def update_post_visibility(post_id, visibility):
    if visibility not in ("public", "followers", "private"):
        return False
    conn = get_conn()
    try:
        conn.execute("UPDATE posts SET visibility = ? WHERE id = ?", (visibility, post_id))
        conn.commit()
        return True
    finally:
        conn.close()



def get_extra_counts(post_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT extra_likes, extra_bookmarks, extra_views, extra_comments "
            "FROM posts WHERE id = ?",
            (post_id,),
        ).fetchone()
        if not row:
            return {"likes": 0, "bookmarks": 0, "views": 0, "comments": 0}
        return {
            "likes": row["extra_likes"] or 0,
            "bookmarks": row["extra_bookmarks"] or 0,
            "views": row["extra_views"] or 0,
            "comments": row["extra_comments"] or 0,
        }
    finally:
        conn.close()


def set_extra_counts(post_id, likes=None, bookmarks=None, views=None, comments=None):
    conn = get_conn()
    try:
        fields = {}
        if likes is not None: fields["extra_likes"] = likes
        if bookmarks is not None: fields["extra_bookmarks"] = bookmarks
        if views is not None: fields["extra_views"] = views
        if comments is not None: fields["extra_comments"] = comments
        if not fields:
            return
        cols = ", ".join("%s = ?" % k for k in fields.keys())
        vals = list(fields.values()) + [post_id]
        conn.execute("UPDATE posts SET %s WHERE id = ?" % cols, vals)
        conn.commit()
    finally:
        conn.close()


def real_like_count(post_id):
    conn = get_conn()
    try:
        real = conn.execute(
            "SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?", (post_id,)
        ).fetchone()["n"]
        extra = conn.execute(
            "SELECT extra_likes FROM posts WHERE id = ?", (post_id,)
        ).fetchone()
        extra_n = (extra["extra_likes"] or 0) if extra else 0
        return real + extra_n
    finally:
        conn.close()


def real_bookmark_count(post_id):
    conn = get_conn()
    try:
        real = conn.execute(
            "SELECT COUNT(*) AS n FROM post_bookmarks WHERE post_id = ?", (post_id,)
        ).fetchone()["n"]
        extra = conn.execute(
            "SELECT extra_bookmarks FROM posts WHERE id = ?", (post_id,)
        ).fetchone()
        extra_n = (extra["extra_bookmarks"] or 0) if extra else 0
        return real + extra_n
    finally:
        conn.close()


def real_view_count(post_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT views, extra_views FROM posts WHERE id = ?", (post_id,)
        ).fetchone()
        if not row:
            return 0
        return (row["views"] or 0) + (row["extra_views"] or 0)
    finally:
        conn.close()


def real_comment_count(post_id):
    conn = get_conn()
    try:
        real = conn.execute(
            "SELECT COUNT(*) AS n FROM post_comments WHERE post_id = ?", (post_id,)
        ).fetchone()["n"]
        extra = conn.execute(
            "SELECT extra_comments FROM posts WHERE id = ?", (post_id,)
        ).fetchone()
        extra_n = (extra["extra_comments"] or 0) if extra else 0
        return real + extra_n
    finally:
        conn.close()


def format_count(n):
    """Format number as K/M."""
    if n < 1000:
        return str(n)
    if n < 1_000_000:
        return "%.1fK" % (n / 1000.0)
    return "%.1fM" % (n / 1_000_000.0)



def list_post_comments(post_id):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT c.*, u.username AS author_username, u.avatar AS author_avatar "
            "FROM post_comments c JOIN users u ON u.id = c.author_id "
            "WHERE c.post_id = ? ORDER BY c.created_at ASC",
            (post_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def add_post_comment(post_id, author_id, body):
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO post_comments (post_id, author_id, body, created_at) VALUES (?, ?, ?, ?)",
            (post_id, author_id, body, now()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def increment_post_views(post_id):
    conn = get_conn()
    try:
        conn.execute("UPDATE posts SET views = views + 1 WHERE id = ?", (post_id,))
        conn.commit()
    finally:
        conn.close()


def is_post_liked(post_id, user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?",
            (post_id, user_id),
        ).fetchone()
        return bool(row)
    finally:
        conn.close()


def toggle_post_like(post_id, user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?",
            (post_id, user_id),
        ).fetchone()
        if row:
            conn.execute("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?", (post_id, user_id))
            liked = False
        else:
            conn.execute(
                "INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)",
                (post_id, user_id, now()),
            )
            liked = True
        conn.commit()
        return liked
    finally:
        conn.close()


def count_post_likes(post_id):
    conn = get_conn()
    try:
        row = conn.execute("SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?", (post_id,)).fetchone()
        return row["n"]
    finally:
        conn.close()


def is_post_bookmarked(post_id, user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM post_bookmarks WHERE post_id = ? AND user_id = ?",
            (post_id, user_id),
        ).fetchone()
        return bool(row)
    finally:
        conn.close()


def toggle_post_bookmark(post_id, user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM post_bookmarks WHERE post_id = ? AND user_id = ?",
            (post_id, user_id),
        ).fetchone()
        if row:
            conn.execute("DELETE FROM post_bookmarks WHERE post_id = ? AND user_id = ?", (post_id, user_id))
            bookmarked = False
        else:
            conn.execute(
                "INSERT INTO post_bookmarks (post_id, user_id, created_at) VALUES (?, ?, ?)",
                (post_id, user_id, now()),
            )
            bookmarked = True
        conn.commit()
        return bookmarked
    finally:
        conn.close()


def is_comment_liked(comment_id, user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM post_comment_likes WHERE comment_id = ? AND user_id = ?",
            (comment_id, user_id),
        ).fetchone()
        return bool(row)
    finally:
        conn.close()


def toggle_comment_like(comment_id, user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM post_comment_likes WHERE comment_id = ? AND user_id = ?",
            (comment_id, user_id),
        ).fetchone()
        if row:
            conn.execute("DELETE FROM post_comment_likes WHERE comment_id = ? AND user_id = ?", (comment_id, user_id))
            liked = False
        else:
            conn.execute(
                "INSERT INTO post_comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)",
                (comment_id, user_id, now()),
            )
            liked = True
        conn.commit()
        return liked
    finally:
        conn.close()


def count_comment_likes(comment_id):
    conn = get_conn()
    try:
        row = conn.execute("SELECT COUNT(*) AS n FROM post_comment_likes WHERE comment_id = ?", (comment_id,)).fetchone()
        return row["n"]
    finally:
        conn.close()


def is_comment_bookmarked(comment_id, user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM post_comment_bookmarks WHERE comment_id = ? AND user_id = ?",
            (comment_id, user_id),
        ).fetchone()
        return bool(row)
    finally:
        conn.close()


def toggle_comment_bookmark(comment_id, user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM post_comment_bookmarks WHERE comment_id = ? AND user_id = ?",
            (comment_id, user_id),
        ).fetchone()
        if row:
            conn.execute("DELETE FROM post_comment_bookmarks WHERE comment_id = ? AND user_id = ?", (comment_id, user_id))
            bookmarked = False
        else:
            conn.execute(
                "INSERT INTO post_comment_bookmarks (comment_id, user_id, created_at) VALUES (?, ?, ?)",
                (comment_id, user_id, now()),
            )
            bookmarked = True
        conn.commit()
        return bookmarked
    finally:
        conn.close()


def get_comment(comment_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT c.*, p.author_id AS post_author_id, p.slug AS post_slug "
            "FROM post_comments c JOIN posts p ON p.id = c.post_id "
            "WHERE c.id = ?",
            (comment_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete_comment(comment_id):
    conn = get_conn()
    try:
        conn.execute("DELETE FROM post_comments WHERE id = ?", (comment_id,))
        conn.commit()
    finally:
        conn.close()



DEFAULT_SETTINGS = {
    "theme": "system",
    "email_notifications": 0,
    "push_notifications": 1,
    "default_visibility": "public",
    "language": "en",
    "show_email": 0,
    "profile_public": 1,
    "compact_mode": 0,
    "show_line_numbers": 0,
}


def get_settings(user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM user_settings WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not row:
            # Create defaults
            conn.execute(
                "INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)",
                (user_id, now()),
            )
            conn.commit()
            return dict(DEFAULT_SETTINGS)
        d = dict(row)
        d.pop("user_id", None)
        d.pop("updated_at", None)
        return d
    finally:
        conn.close()


def update_settings(user_id, fields):
    allowed = set(DEFAULT_SETTINGS.keys())
    update = {k: v for k, v in fields.items() if k in allowed}
    if not update:
        return False
    # Validate
    if "theme" in update and update["theme"] not in ("light", "dark", "system"):
        update["theme"] = "system"
    if "default_visibility" in update and update["default_visibility"] not in ("public", "followers", "private"):
        update["default_visibility"] = "public"
    if "language" in update and update["language"] not in ("en", "ar"):
        update["language"] = "en"

    conn = get_conn()
    try:
        # Ensure row exists
        conn.execute(
            "INSERT OR IGNORE INTO user_settings (user_id, updated_at) VALUES (?, ?)",
            (user_id, now()),
        )
        cols = ", ".join("%s = ?" % k for k in update.keys())
        vals = list(update.values()) + [now(), user_id]
        conn.execute("UPDATE user_settings SET %s, updated_at = ? WHERE user_id = ?" % cols, vals)
        conn.commit()
        return True
    finally:
        conn.close()



def get_2fa(user_id):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM user_2fa WHERE user_id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_2fa(user_id, secret):
    """Create a pending 2FA setup (not enabled)."""
    conn = get_conn()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO user_2fa (user_id, secret, enabled, created_at) "
            "VALUES (?, ?, 0, ?)",
            (user_id, secret, now()),
        )
        conn.commit()
    finally:
        conn.close()


def enable_2fa(user_id, backup_codes):
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE user_2fa SET enabled = 1, backup_codes = ?, enabled_at = ? "
            "WHERE user_id = ?",
            (",".join(backup_codes), now(), user_id),
        )
        conn.commit()
    finally:
        conn.close()


def disable_2fa(user_id):
    conn = get_conn()
    try:
        conn.execute("DELETE FROM user_2fa WHERE user_id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()


def consume_backup_code(user_id, code):
    """Check if a backup code matches (and remove it)."""
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT backup_codes FROM user_2fa WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not row or not row["backup_codes"]:
            return False
        codes = row["backup_codes"].split(",")
        code = code.strip().upper()
        if code in codes:
            codes.remove(code)
            conn.execute(
                "UPDATE user_2fa SET backup_codes = ? WHERE user_id = ?",
                (",".join(codes), user_id),
            )
            conn.commit()
            return True
        return False
    finally:
        conn.close()



def clear_notifications(user_id):
    """Delete all notifications for a user."""
    conn = get_conn()
    try:
        conn.execute("DELETE FROM notifications WHERE user_id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()


def delete_notification(notification_id, user_id):
    """Delete a specific notification (owner only)."""
    conn = get_conn()
    try:
        conn.execute(
            "DELETE FROM notifications WHERE id = ? AND user_id = ?",
            (notification_id, user_id),
        )
        conn.commit()
    finally:
        conn.close()
