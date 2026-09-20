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


# ---------- users ----------

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


# ---------- sessions ----------

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


# ---------- repos ----------

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
        sql = "SELECT * FROM repos WHERE owner_id = ?"
        if not include_private:
            sql += " AND is_private = 0"
        sql += " ORDER BY updated_at DESC"
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


# ---------- forks ----------

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
