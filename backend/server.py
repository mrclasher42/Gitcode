#!/usr/bin/env python3
"""GitCode backend API server."""
import os
import sys
import json
import time
import re
import shutil
import tempfile
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote, quote
from http.cookies import SimpleCookie

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import db
import auth
import git_ops

PORT = int(os.environ.get("PORT", "8080"))
COOKIE_NAME = "gc_session"

USERNAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$")
REPO_RE = re.compile(r"^[a-zA-Z0-9._-]{1,100}$")


# ---------- helpers ----------

def json_response(handler, status, data, extra_headers=None):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    if extra_headers:
        for k, v in extra_headers:
            handler.send_header(k, v)
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length == 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None


def current_user(handler):
    cookie = SimpleCookie(handler.headers.get("Cookie", ""))
    morsel = cookie.get(COOKIE_NAME)
    if not morsel:
        return None
    sess = db.get_session(morsel.value)
    if not sess:
        return None
    return db.get_user_by_id(sess["user_id"])


def make_set_cookie(token, max_age):
    return (
        "Set-Cookie",
        "%s=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Lax" % (
            COOKIE_NAME, token, max_age
        ),
    )


def public_user(u):
    return {
        "id": u["id"],
        "username": u["username"],
        "bio": u.get("bio", ""),
        "location": u.get("location", ""),
        "website": u.get("website", ""),
        "created_at": u["created_at"],
    }


def public_repo(r):
    d = {
        "id": r["id"],
        "name": r["name"],
        "description": r.get("description", ""),
        "is_private": bool(r.get("is_private", 0)),
        "default_branch": r.get("default_branch", "main"),
        "owner_username": r.get("owner_username"),
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }
    parent_id = r.get("parent_id")
    if parent_id:
        parent = db.get_repo_by_id(parent_id)
        if parent:
            d["fork"] = {
                "parent_id": parent_id,
                "parent_owner": parent["owner_username"],
                "parent_name": parent["name"],
            }
    return d


# ---------- handlers ----------

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        sys.stderr.write("[gc] %s\n" % (fmt % args))

    # ----- CORS -----
    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:"):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    # ----- GET -----
    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        qs = parse_qs(parsed.query)
        try:
            return self._route_get(path, qs)
        except Exception as e:
            json_response(self, 500, {"error": "server_error", "detail": str(e)})

    def _route_get(self, path, qs):
        # --- auth ---
        if path == "/api/auth/me":
            u = current_user(self)
            if not u:
                return json_response(self, 401, {"error": "not_authenticated"})
            return json_response(self, 200, {"user": public_user(u)})

        # --- users ---
        m = re.match(r"^/api/users/([^/]+)$", path)
        if m:
            u = db.get_user_by_username(m.group(1))
            if not u:
                return json_response(self, 404, {"error": "user_not_found"})
            repos = db.list_repos_by_owner(u["id"], include_private=False)
            return json_response(self, 200, {
                "user": public_user(u),
                "repos": [public_repo(r) for r in repos],
            })

        # --- repos ---
        if path == "/api/repos":
            repos = db.list_public_repos(50)
            return json_response(self, 200, {
                "repos": [
                    {**public_repo(r), "owner_username": r.get("owner_username")}
                    for r in repos
                ]
            })

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)$", path)
        if m:
            return self._get_repo(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/tree$", path)
        if m:
            return self._get_tree(m.group(1), m.group(2), qs)

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/blob$", path)
        if m:
            return self._get_blob(m.group(1), m.group(2), qs)

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/commits$", path)
        if m:
            return self._get_commits(m.group(1), m.group(2), qs)

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/branches$", path)
        if m:
            return self._get_branches(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/bundle$", path)
        if m:
            return self._get_bundle(m.group(1), m.group(2))

        return json_response(self, 404, {"error": "not_found", "path": path})

    def _get_repo(self, owner, name):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        me = current_user(self)
        if r["is_private"] and (not me or me["id"] != r["owner_id"]):
            return json_response(self, 404, {"error": "repo_not_found"})
        return json_response(self, 200, {"repo": public_repo(r)})

    def _get_tree(self, owner, name, qs):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        branch = qs.get("branch", [r["default_branch"]])[0]
        path = qs.get("path", [""])[0]
        entries = git_ops.list_tree(owner, name, branch, path)
        return json_response(self, 200, {
            "branch": branch,
            "path": path,
            "entries": entries,
        })

    def _get_blob(self, owner, name, qs):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        branch = qs.get("branch", [r["default_branch"]])[0]
        path = qs.get("path", [""])[0]
        if not path:
            return json_response(self, 400, {"error": "missing_path"})
        content = git_ops.read_blob(owner, name, branch, path)
        if content is None:
            return json_response(self, 404, {"error": "blob_not_found"})
        return json_response(self, 200, {
            "branch": branch,
            "path": path,
            "content": content,
        })

    def _get_commits(self, owner, name, qs):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        branch = qs.get("branch", [r["default_branch"]])[0]
        limit = int(qs.get("limit", ["50"])[0])
        commits = git_ops.list_commits(owner, name, branch, limit)
        return json_response(self, 200, {"branch": branch, "commits": commits})

    def _get_branches(self, owner, name):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        branches = git_ops.list_branches(owner, name)
        return json_response(self, 200, {
            "branches": branches,
            "default_branch": r["default_branch"],
        })

    def _get_bundle(self, owner, name):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        repo_path = git_ops.repo_path(owner, name)
        if not os.path.isdir(repo_path):
            return json_response(self, 404, {"error": "repo_missing_on_disk"})
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".bundle")
        tmp.close()
        try:
            subprocess.run(
                ["git", "bundle", "create", tmp.name, "--all"],
                cwd=repo_path, check=True, capture_output=True,
            )
            with open(tmp.name, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self._cors()
            self.end_headers()
            self.wfile.write(data)
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    # ----- POST -----
    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            return self._route_post(path)
        except Exception as e:
            json_response(self, 500, {"error": "server_error", "detail": str(e)})

    def _route_post(self, path):
        if path == "/api/auth/signup":
            return self._signup()
        if path == "/api/auth/login":
            return self._login()
        if path == "/api/auth/logout":
            return self._logout()
        if path == "/api/repos":
            return self._create_repo()

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/push$", path)
        if m:
            return self._push(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/fork$", path)
        if m:
            return self._fork(m.group(1), m.group(2))

        return json_response(self, 404, {"error": "not_found", "path": path})

    def _signup(self):
        data = read_json_body(self)
        if data is None:
            return json_response(self, 400, {"error": "invalid_json"})
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip()
        password = data.get("password") or ""

        if not USERNAME_RE.match(username):
            return json_response(self, 400, {"error": "invalid_username"})
        if "@" not in email or len(email) > 200:
            return json_response(self, 400, {"error": "invalid_email"})
        if len(password) < 6:
            return json_response(self, 400, {"error": "password_too_short"})

        if db.get_user_by_username(username):
            return json_response(self, 409, {"error": "username_taken"})

        pwd_hash, salt = auth.hash_password(password)
        try:
            uid = db.create_user(username, email, pwd_hash, salt)
        except Exception:
            return json_response(self, 409, {"error": "email_taken"})

        token = auth.new_session_token()
        db.create_session(token, uid, db.now() + auth.SESSION_TTL)
        u = db.get_user_by_id(uid)
        json_response(
            self, 201,
            {"user": public_user(u)},
            extra_headers=[make_set_cookie(token, auth.SESSION_TTL)],
        )

    def _login(self):
        data = read_json_body(self)
        if data is None:
            return json_response(self, 400, {"error": "invalid_json"})
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        u = db.get_user_by_username(username)
        if not u or not auth.verify_password(password, u["password_hash"], u["salt"]):
            return json_response(self, 401, {"error": "invalid_credentials"})

        token = auth.new_session_token()
        db.create_session(token, u["id"], db.now() + auth.SESSION_TTL)
        json_response(
            self, 200,
            {"user": public_user(u)},
            extra_headers=[make_set_cookie(token, auth.SESSION_TTL)],
        )

    def _logout(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get(COOKIE_NAME)
        if morsel:
            db.delete_session(morsel.value)
        json_response(
            self, 200, {"ok": True},
            extra_headers=[make_set_cookie("", 0)],
        )

    def _create_repo(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        data = read_json_body(self)
        if data is None:
            return json_response(self, 400, {"error": "invalid_json"})
        name = (data.get("name") or "").strip()
        description = (data.get("description") or "").strip()
        is_private = 1 if data.get("private") else 0

        if not REPO_RE.match(name):
            return json_response(self, 400, {"error": "invalid_repo_name"})
        if db.get_repo(me["username"], name):
            return json_response(self, 409, {"error": "repo_exists"})

        git_ops.create_repo(me["username"], name)
        rid = db.create_repo(me["id"], name, description, is_private)
        r = db.get_repo(me["username"], name)
        r["owner_username"] = me["username"]
        return json_response(self, 201, {"repo": public_repo(r)})

    def _fork(self, owner, name):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})

        src = db.get_repo(owner, name)
        if not src:
            return json_response(self, 404, {"error": "repo_not_found"})
        if src["is_private"] and src["owner_id"] != me["id"]:
            return json_response(self, 404, {"error": "repo_not_found"})

        if src["owner_id"] == me["id"]:
            return json_response(self, 400, {"error": "cannot_fork_own_repo"})

        fork_name = src["name"]
        existing = db.get_repo(me["username"], fork_name)
        if existing:
            return json_response(self, 409, {"error": "fork_already_exists"})

        try:
            git_ops.fork_repo(owner, name, me["username"], fork_name)
        except Exception as e:
            return json_response(self, 500, {"error": "fork_failed", "detail": str(e)})

        rid = db.create_fork(
            me["id"], fork_name,
            src.get("description", ""), 0,
            parent_id=src["id"],
        )

        r = db.get_repo(me["username"], fork_name)
        r["owner_username"] = me["username"]
        return json_response(self, 201, {"repo": public_repo(r)})

    def _push(self, owner, name):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})

        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})

        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return json_response(self, 400, {"error": "empty_body"})

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".bundle")
        try:
            remaining = length
            while remaining > 0:
                chunk = self.rfile.read(min(65536, remaining))
                if not chunk:
                    break
                tmp.write(chunk)
                remaining -= len(chunk)
            tmp.close()

            repo_path = git_ops.repo_path(owner, name)
            branches = ["refs/heads/*:refs/heads/*"]
            result = subprocess.run(
                ["git", "fetch", tmp.name] + branches,
                cwd=repo_path,
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                return json_response(self, 400, {
                    "error": "fetch_failed",
                    "stderr": result.stderr,
                })

            db.update_repo_timestamp(r["id"])
            return json_response(self, 200, {"ok": True})
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    # ----- DELETE -----
    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)$", path)
        if m:
            me = current_user(self)
            if not me:
                return json_response(self, 401, {"error": "not_authenticated"})
            owner, name = m.group(1), m.group(2)
            if me["username"].lower() != owner.lower():
                return json_response(self, 403, {"error": "not_owner"})
            r = db.get_repo(owner, name)
            if not r:
                return json_response(self, 404, {"error": "repo_not_found"})
            git_ops.delete_repo(owner, name)
            db.delete_repo(r["id"])
            return json_response(self, 200, {"ok": True})

        return json_response(self, 404, {"error": "not_found"})


def main():
    db.init_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print("GitCode API on http://localhost:%d" % PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")
        server.shutdown()


if __name__ == "__main__":
    main()
