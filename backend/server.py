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
import totp
import config

PORT = int(os.environ.get("PORT", "8080"))
COOKIE_NAME = "gc_session"

USERNAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$")
REPO_RE = re.compile(r"^[a-zA-Z0-9._-]{1,100}$")



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


def require_write(handler, user):
    """If authenticated via API token, require write scope."""
    auth = handler.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return True  # session cookies always have write
    token = auth[7:].strip()
    t = db.get_token(token)
    if not t:
        return False
    scopes = (t.get("scopes") or "").split(",")
    return "write" in scopes


def current_user(handler):
    # 1. Try Authorization: Bearer <token>
    auth = handler.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        t = db.get_token(token)
        if t:
            return db.get_user_by_id(t["user_id"])

    # 2. Fall back to session cookie
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


def private_user(u):
    """public_user + email + private fields (only for current user)."""
    d = public_user(u)
    d["email"] = u.get("email", "")
    return d


def public_user(u):
    return {
        "id": u["id"],
        "username": u["username"],
        "bio": u.get("bio", ""),
        "location": u.get("location", ""),
        "website": u.get("website", ""),
        "avatar": u.get("avatar") or "",
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



class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        sys.stderr.write("[gc] %s\n" % (fmt % args))

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

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        qs = parse_qs(parsed.query)
        try:
            return self._route_get(path, qs)
        except Exception as e:
            json_response(self, 500, {"error": "server_error", "detail": str(e)})

    def _get_public_config(self):
        return json_response(self, 200, {
            "site_name": config.site_name(),
            "site_description": config.get("site_description", ""),
            "allow_signup": config.allow_signup(),
            "allow_forks": config.allow_forks(),
            "allow_private": config.allow_private(),
            "enable_issues": config.enable_issues(),
            "default_branch": config.default_branch(),
        })

    def _route_get(self, path, qs):
        if path == "/api/config":
            return self._get_public_config()

        if path == "/api/tokens":
            me = current_user(self)
            if not me:
                return json_response(self, 401, {"error": "not_authenticated"})
            return json_response(self, 200, {"tokens": db.list_tokens(me["id"])})

        if path == "/api/auth/me":
            u = current_user(self)
            if not u:
                return json_response(self, 401, {"error": "not_authenticated"})
            return json_response(self, 200, {"user": public_user(u)})

        m = re.match(r"^/api/users/([^/]+)/avatar$", path)
        if m:
            return self._get_avatar(m.group(1))

        m = re.match(r"^/api/users/([^/]+)/followers$", path)
        if m:
            return self._followers(m.group(1))

        m = re.match(r"^/api/users/([^/]+)/following$", path)
        if m:
            return self._following(m.group(1))

        if path == "/api/notifications":
            me = current_user(self)
            if not me:
                return json_response(self, 401, {"error": "not_authenticated"})
            unread = qs.get("unread", ["0"])[0] == "1"
            items = db.list_notifications(me["id"], unread_only=unread)
            return json_response(self, 200, {
                "notifications": items,
                "unread": db.count_unread_notifications(me["id"]),
            })

        if path == "/api/2fa/status":
            me = current_user(self)
            if not me:
                return json_response(self, 401, {"error": "not_authenticated"})
            row = db.get_2fa(me["id"])
            return json_response(self, 200, {
                "enabled": bool(row and row["enabled"]),
                "pending": bool(row and not row["enabled"]),
            })

        if path == "/api/settings":
            me = current_user(self)
            if not me:
                return json_response(self, 401, {"error": "not_authenticated"})
            return json_response(self, 200, {"settings": db.get_settings(me["id"])})

        if path == "/api/notifications/count":
            me = current_user(self)
            if not me:
                return json_response(self, 200, {"unread": 0})
            return json_response(self, 200, {"unread": db.count_unread_notifications(me["id"])})

        m = re.match(r"^/api/users/([^/]+)$", path)
        if m:
            u = db.get_user_by_username(m.group(1))
            if not u:
                return json_response(self, 404, {"error": "user_not_found"})
            repos = db.list_repos_by_owner(u["id"], include_private=False)
            starred = db.list_starred_repos(u["id"])
            me = current_user(self)
            is_self = bool(me and me["id"] == u["id"])
            following = bool(me and db.is_following(me["id"], u["id"]))
            return json_response(self, 200, {
                "user": public_user(u),
                "repos": [public_repo(r) for r in repos],
                "starred": [public_repo(r) for r in starred],
                "followers": db.count_followers(u["id"]),
                "following_count": db.count_following(u["id"]),
                "is_self": is_self,
                "is_following": following,
            })

        if path == "/api/posts":
            feed = qs.get("feed", ["all"])[0]
            limit = int(qs.get("limit", ["30"])[0])
            offset = int(qs.get("offset", ["0"])[0])
            author = qs.get("author", [""])[0]
            me = current_user(self)
            viewer_id = me["id"] if me else None
            if feed == "following":
                if not me:
                    return json_response(self, 401, {"error": "not_authenticated"})
                posts = db.list_following_posts(me["id"], limit=limit, offset=offset)
            elif author:
                u = db.get_user_by_username(author)
                if not u:
                    return json_response(self, 404, {"error": "user_not_found"})
                posts = db.list_posts(
                    limit=limit, offset=offset, author_id=u["id"], viewer_id=viewer_id
                )
            else:
                posts = db.list_posts(limit=limit, offset=offset, viewer_id=viewer_id)
            for p in posts:
                p["post_url"] = "/posts/" + p["slug"]
            return json_response(self, 200, {"posts": posts})

        m = re.match(r"^/api/posts/([^/]+)$", path)
        if m:
            return self._get_post(m.group(1))



        m = re.match(r"^/api/posts/([^/]+)/comments$", path)
        if m:
            return self._list_post_comments(m.group(1))

        if path == "/api/activities":
            limit = int(qs.get("limit", ["30"])[0])
            acts = db.list_activities(limit)
            return json_response(self, 200, {"activities": acts})

        if path == "/api/repos/mine":
            me = current_user(self)
            if not me:
                return json_response(self, 401, {"error": "not_authenticated"})
            repos = db.list_repos_by_owner(me["id"], include_private=True)
            return json_response(self, 200, {
                "repos": [public_repo(r) for r in repos]
            })

        if path == "/api/repos":
            repos = db.list_public_repos(50)
            return json_response(self, 200, {
                "repos": [
                    {**public_repo(r), "owner_username": r.get("owner_username")}
                    for r in repos
                ]
            })

        m = re.match(r"^/api/posts/([^/]+)$", path)
        if m:
            return self._update_post(m.group(1))

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

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/branches/full$", path)
        if m:
            return self._list_branches_full(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/branches$", path)
        if m:
            return self._get_branches(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/search$", path)
        if m:
            return self._search_repo(m.group(1), m.group(2), qs)

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/diff$", path)
        if m:
            return self._get_diff(m.group(1), m.group(2), qs)

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/forks$", path)
        if m:
            return self._list_forks(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/contributors$", path)
        if m:
            return self._list_contributors(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/social$", path)
        if m:
            return self._get_social(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/star$", path)
        if m:
            return self._toggle_star(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/watch$", path)
        if m:
            return self._toggle_watch(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/releases$", path)
        if m:
            return self._list_releases(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/releases/(\d+)$", path)
        if m:
            return self._get_release(m.group(1), m.group(2), int(m.group(3)))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/releases/assets/(\d+)/download$", path)
        if m:
            return self._download_asset(int(m.group(3)))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/issues$", path)
        if m:
            return self._list_issues(m.group(1), m.group(2), qs)

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/branches$", path)
        if m:
            return self._set_default_branch(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/issues/(\d+)$", path)
        if m:
            return self._get_issue(m.group(1), m.group(2), int(m.group(3)))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/contents$", path)
        if m:
            return self._get_contents(m.group(1), m.group(2), qs)

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/raw$", path)
        if m:
            return self._get_raw(m.group(1), m.group(2), qs)

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

    def _search_repo(self, owner, name, qs):
        """Simple grep over all files in repo."""
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        q = qs.get("q", [""])[0]
        if not q or len(q) < 2:
            return json_response(self, 400, {"error": "query_too_short"})

        branch = qs.get("branch", [r["default_branch"]])[0]
        results = []
        ql = q.lower()

        def walk(path=""):
            entries = git_ops.list_tree(owner, name, branch, path)
            for e in entries:
                if e["type"] == "tree":
                    walk(e["path"])
                else:
                    if len(results) >= 50:
                        return
                    # Skip binary extensions
                    ext = e["name"].rsplit(".", 1)[-1].lower() if "." in e["name"] else ""
                    if ext in ("png","jpg","jpeg","gif","svg","webp","ico","zip","gz","pdf","woff","woff2","ttf","exe","bin","so","class"):
                        continue
                    content = git_ops.read_blob(owner, name, branch, e["path"])
                    if content is None:
                        continue
                    lines = content.split("\n")
                    for i, line in enumerate(lines):
                        if ql in line.lower():
                            results.append({
                                "path": e["path"],
                                "line": i + 1,
                                "text": line[:200],
                            })
                            if len(results) >= 50:
                                return

        walk("")
        return json_response(self, 200, {"query": q, "results": results})

    def _get_diff(self, owner, name, qs):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        sha = qs.get("sha", [""])[0]
        sha_a = qs.get("a", [""])[0]
        sha_b = qs.get("b", [""])[0]
        if sha:
            text = git_ops.diff_commit(owner, name, sha)
        elif sha_a and sha_b:
            text = git_ops.diff_between(owner, name, sha_a, sha_b)
        else:
            return json_response(self, 400, {"error": "missing_sha"})
        return json_response(self, 200, {"diff": text})


    def _update_issue(self, owner, name, number):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        issue = db.get_issue(r["id"], number)
        if not issue:
            return json_response(self, 404, {"error": "issue_not_found"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        state = data.get("state")
        if state not in ("open", "closed"):
            return json_response(self, 400, {"error": "invalid_state"})
        db.update_issue_state(issue["id"], state)
        return json_response(self, 200, {"ok": True})


    def _list_branches_full(self, owner, name):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        branches = git_ops.list_branches(owner, name)
        items = []
        for b in branches:
            info = git_ops.branch_info(owner, name, b)
            items.append({
                "name": b,
                "is_default": b == r["default_branch"],
                "last_commit": info,
            })
        return json_response(self, 200, {
            "branches": items,
            "default_branch": r["default_branch"],
        })

    def _create_branch(self, owner, name):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        new_branch = (data.get("name") or "").strip()
        from_branch = (data.get("from") or r["default_branch"]).strip()
        if not new_branch:
            return json_response(self, 400, {"error": "missing_name"})
        import re as _re
        if not _re.match(r"^[a-zA-Z0-9._/-]{1,100}$", new_branch):
            return json_response(self, 400, {"error": "invalid_name"})
        try:
            git_ops.create_branch(owner, name, new_branch, from_branch)
        except Exception as e:
            return json_response(self, 400, {"error": "create_failed", "detail": str(e)})
        return json_response(self, 201, {"ok": True})

    def _delete_branch(self, owner, name, branch):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        if branch == r["default_branch"]:
            return json_response(self, 400, {"error": "cannot_delete_default"})
        try:
            git_ops.delete_branch(owner, name, branch)
        except Exception as e:
            return json_response(self, 400, {"error": "delete_failed", "detail": str(e)})
        return json_response(self, 200, {"ok": True})

    def _set_default_branch(self, owner, name):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        data = read_json_body(self)
        if not data or not data.get("branch"):
            return json_response(self, 400, {"error": "missing_branch"})
        branch = data["branch"]
        if branch not in git_ops.list_branches(owner, name):
            return json_response(self, 404, {"error": "branch_not_found"})
        try:
            git_ops.set_default_branch(owner, name, branch)
            db.set_default_branch(r["id"], branch)
        except Exception as e:
            return json_response(self, 500, {"error": "set_failed", "detail": str(e)})
        return json_response(self, 200, {"ok": True})

    def _get_avatar(self, username):
        u = db.get_user_by_username(username)
        if not u:
            return self._send_404_plain()
        avatar = u.get("avatar")
        if not avatar:
            return self._send_404_plain()
        # avatar is a filename inside data/avatars/
        import os as _os
        base = _os.path.abspath(_os.path.join(HERE, "..", "data", "avatars"))
        full = _os.path.abspath(_os.path.join(base, avatar))
        if not full.startswith(base) or not _os.path.isfile(full):
            return self._send_404_plain()

        with open(full, "rb") as f:
            data = f.read()

        # Guess content type
        ext = _os.path.splitext(avatar)[1].lower()
        ctypes = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        ctype = ctypes.get(ext, "application/octet-stream")

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=300")
        self.end_headers()
        self.wfile.write(data)

    def _send_404_plain(self):
        self.send_response(404)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"not found")

    def _upload_avatar(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})

        ctype = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in ctype:
            return json_response(self, 400, {"error": "expected_multipart"})

        import re as _re
        m = _re.search(r"boundary=([^;]+)", ctype)
        if not m:
            return json_response(self, 400, {"error": "no_boundary"})
        boundary = m.group(1).strip().strip(chr(34))

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)

        delim = b"--" + boundary.encode()
        parts = body.split(delim)
        file_data = None
        filename = None

        for part in parts:
            if b"Content-Disposition" not in part:
                continue
            crlf2 = bytes([13, 10, 13, 10])
            header_end = part.find(crlf2)
            if header_end == -1:
                continue
            header = part[:header_end].decode("utf-8", "replace")
            content = part[header_end + 4:]
            if content.endswith(bytes([13, 10])):
                content = content[:-2]

            fm = _re.search(r'filename="([^"]*)"', header)
            if fm:
                filename = fm.group(1)
                file_data = content
                break

        if not file_data:
            return json_response(self, 400, {"error": "no_file"})

        if len(file_data) > 2 * 1024 * 1024:
            return json_response(self, 400, {"error": "file_too_large"})

        import os as _os, time as _time
        ext = _os.path.splitext(filename or "")[1].lower()
        if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
            return json_response(self, 400, {"error": "invalid_ext"})

        avatars_dir = _os.path.abspath(_os.path.join(HERE, "..", "data", "avatars"))
        _os.makedirs(avatars_dir, exist_ok=True)
        new_name = "u%d_%d%s" % (me["id"], int(_time.time()), ext)
        full = _os.path.join(avatars_dir, new_name)
        with open(full, "wb") as f:
            f.write(file_data)

        db.set_avatar(me["id"], new_name)
        u = db.get_user_by_id(me["id"])
        return json_response(self, 200, {"user": public_user(u)})

    def _change_username(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        new_username = (data.get("username") or "").strip()
        if not USERNAME_RE.match(new_username):
            return json_response(self, 400, {"error": "invalid_username"})
        if new_username.lower() == me["username"].lower():
            return json_response(self, 200, {"ok": True, "unchanged": True})
        if db.get_user_by_username(new_username):
            return json_response(self, 409, {"error": "username_taken"})
        if not db.update_username(me["id"], new_username):
            return json_response(self, 409, {"error": "username_taken"})
        u = db.get_user_by_id(me["id"])
        return json_response(self, 200, {"user": public_user(u)})

    def _create_token(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        name = (data.get("name") or "").strip()
        if not name:
            return json_response(self, 400, {"error": "missing_name"})

        # Duration: 0 = never, else days
        days = int(data.get("days", 30))
        if days < 0:
            days = 0
        expires_at = None if days == 0 else (db.now() + days * 86400)

        # Scopes: comma-separated read,write
        scopes_raw = data.get("scopes") or ["read"]
        if isinstance(scopes_raw, list):
            scopes_list = [s for s in scopes_raw if s in ("read", "write")]
        else:
            scopes_list = [s for s in str(scopes_raw).split(",") if s in ("read", "write")]
        if not scopes_list:
            scopes_list = ["read"]
        scopes = ",".join(scopes_list)

        import secrets as _secrets
        token = "gc_" + _secrets.token_urlsafe(32)
        db.create_token(me["id"], token, name, scopes=scopes, expires_at=expires_at)
        return json_response(self, 201, {
            "token": token,
            "name": name,
            "scopes": scopes,
            "expires_at": expires_at,
        })

    def _delete_token(self, token_id):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        db.delete_token(me["id"], token_id)
        return json_response(self, 200, {"ok": True})

    def _followers(self, username):
        u = db.get_user_by_username(username)
        if not u:
            return json_response(self, 404, {"error": "user_not_found"})
        items = db.list_followers(u["id"])
        return json_response(self, 200, {"followers": items})

    def _following(self, username):
        u = db.get_user_by_username(username)
        if not u:
            return json_response(self, 404, {"error": "user_not_found"})
        items = db.list_following(u["id"])
        return json_response(self, 200, {"following": items})

    def _follow(self, username):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        u = db.get_user_by_username(username)
        if not u:
            return json_response(self, 404, {"error": "user_not_found"})
        if u["id"] == me["id"]:
            return json_response(self, 400, {"error": "cannot_follow_self"})
        db.follow(me["id"], u["id"])
        db.create_notification(u["id"], me["id"], "follow")
        return json_response(self, 200, {
            "following": True,
            "followers": db.count_followers(u["id"]),
        })

    def _unfollow(self, username):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        u = db.get_user_by_username(username)
        if not u:
            return json_response(self, 404, {"error": "user_not_found"})
        db.unfollow(me["id"], u["id"])
        return json_response(self, 200, {
            "following": False,
            "followers": db.count_followers(u["id"]),
        })

    def _update_profile(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        db.update_user_profile(
            me["id"],
            bio=data.get("bio"),
            location=data.get("location"),
            website=data.get("website"),
        )
        u = db.get_user_by_id(me["id"])
        return json_response(self, 200, {"user": public_user(u)})

    def _mark_notifications_read(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        db.mark_notifications_read(me["id"])
        return json_response(self, 200, {"ok": True})

    def _list_forks(self, owner, name):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        forks = db.list_forks(r["id"])
        return json_response(self, 200, {
            "forks": [public_repo(f) for f in forks],
        })

    def _list_contributors(self, owner, name):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        # contributors = authors of commits
        commits = git_ops.list_commits(owner, name, r["default_branch"], limit=500)
        seen = {}
        for c in commits:
            key = c["author_email"] or c["author_name"]
            if key not in seen:
                seen[key] = {
                    "name": c["author_name"],
                    "email": c["author_email"],
                    "commits": 0,
                }
            seen[key]["commits"] += 1
        items = sorted(seen.values(), key=lambda x: -x["commits"])
        return json_response(self, 200, {"contributors": items})


    def _list_releases(self, owner, name):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        releases = db.list_releases(r["id"], include_drafts=False)
        for rel in releases:
            rel["assets"] = db.list_release_assets(rel["id"])
        return json_response(self, 200, {"releases": releases})

    def _get_release(self, owner, name, release_id):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        rel = db.get_release(r["id"], release_id)
        if not rel:
            return json_response(self, 404, {"error": "release_not_found"})
        rel["assets"] = db.list_release_assets(release_id)
        return json_response(self, 200, {"release": rel})

    def _create_release(self, owner, name):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        tag = (data.get("tag") or "").strip()
        title = (data.get("name") or "").strip() or tag
        body = data.get("body") or ""
        is_draft = bool(data.get("draft"))
        is_prerelease = bool(data.get("prerelease"))
        if not tag:
            return json_response(self, 400, {"error": "missing_tag"})
        try:
            rid = db.create_release(r["id"], me["id"], tag, title, body, is_draft, is_prerelease)
        except Exception as e:
            return json_response(self, 409, {"error": "release_exists", "detail": str(e)})
        return json_response(self, 201, {"id": rid})

    def _delete_release(self, owner, name, release_id):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        db.delete_release(r["id"], release_id)
        return json_response(self, 200, {"ok": True})

    def _upload_asset(self, owner, name, release_id):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        rel = db.get_release(r["id"], release_id)
        if not rel:
            return json_response(self, 404, {"error": "release_not_found"})

        # Parse multipart
        ctype = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in ctype:
            return json_response(self, 400, {"error": "expected_multipart"})

        import re as _re
        m = _re.search(r"boundary=([^;]+)", ctype)
        if not m:
            return json_response(self, 400, {"error": "no_boundary"})
        boundary = m.group(1).strip().strip(chr(34))

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)

        delim = b"--" + boundary.encode()
        parts = body.split(delim)
        file_data = None
        filename = None
        content_type = "application/octet-stream"

        for part in parts:
            if b"Content-Disposition" not in part:
                continue
            crlf2 = bytes([13, 10, 13, 10])
            header_end = part.find(crlf2)
            if header_end == -1:
                continue
            header = part[:header_end].decode("utf-8", "replace")
            content = part[header_end + 4:]
            if content.endswith(bytes([13, 10])):
                content = content[:-2]

            fm = _re.search(r'filename="([^"]*)"', header)
            if fm:
                filename = fm.group(1)
                file_data = content
                # Try to find content-type
                cm = _re.search(r"Content-Type:\s*([^\r\n]+)", header)
                if cm:
                    content_type = cm.group(1).strip()
                break

        if not file_data:
            return json_response(self, 400, {"error": "no_file"})

        # 500MB limit
        if len(file_data) > 500 * 1024 * 1024:
            return json_response(self, 400, {"error": "file_too_large"})

        import os as _os, time as _time
        uploads_dir = _os.path.abspath(_os.path.join(HERE, "..", "data", "releases"))
        _os.makedirs(uploads_dir, exist_ok=True)
        safe_name = _re.sub(r"[^A-Za-z0-9._-]+", "_", filename or "file")
        stored = "r%d_%d_%s" % (release_id, int(_time.time()), safe_name)
        full = _os.path.join(uploads_dir, stored)
        with open(full, "wb") as f:
            f.write(file_data)

        aid = db.add_release_asset(release_id, filename, content_type, len(file_data), stored)
        return json_response(self, 201, {
            "id": aid,
            "filename": filename,
            "size": len(file_data),
        })

    def _download_asset(self, asset_id):
        asset = db.get_release_asset(asset_id)
        if not asset:
            return json_response(self, 404, {"error": "asset_not_found"})
        import os as _os
        base = _os.path.abspath(_os.path.join(HERE, "..", "data", "releases"))
        full = _os.path.abspath(_os.path.join(base, asset["path"]))
        if not full.startswith(base) or not _os.path.isfile(full):
            return json_response(self, 404, {"error": "file_missing"})

        db.increment_asset_downloads(asset_id)

        with open(full, "rb") as f:
            data = f.read()

        self.send_response(200)
        self.send_header("Content-Type", asset["content_type"] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition",
                         'attachment; filename="%s"' % asset["filename"].replace('"', ""))
        self.end_headers()
        self.wfile.write(data)


    def _toggle_comment_like(self, comment_id):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        c = db.get_comment(comment_id)
        if not c:
            return json_response(self, 404, {"error": "comment_not_found"})
        liked = db.toggle_comment_like(comment_id, me["id"])
        return json_response(self, 200, {
            "liked": liked,
            "likes": db.count_comment_likes(comment_id),
        })

    def _toggle_comment_bookmark(self, comment_id):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        c = db.get_comment(comment_id)
        if not c:
            return json_response(self, 404, {"error": "comment_not_found"})
        bookmarked = db.toggle_comment_bookmark(comment_id, me["id"])
        return json_response(self, 200, {"bookmarked": bookmarked})

    def _delete_comment(self, comment_id):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        c = db.get_comment(comment_id)
        if not c:
            return json_response(self, 404, {"error": "comment_not_found"})
        # Author of comment OR author of post can delete
        if c["author_id"] != me["id"] and c["post_author_id"] != me["id"]:
            return json_response(self, 403, {"error": "not_allowed"})
        db.delete_comment(comment_id)
        return json_response(self, 200, {"ok": True})


    def _2fa_setup(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})

        row = db.get_2fa(me["id"])
        if row and row["enabled"]:
            return json_response(self, 400, {"error": "already_enabled"})

        secret = totp.generate_secret()
        db.create_2fa(me["id"], secret)
        uri = totp.provisioning_uri(secret, me["username"])
        qr_url = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + __import__("urllib.parse", fromlist=["quote"]).quote(uri)
        return json_response(self, 200, {
            "secret": secret,
            "uri": uri,
            "qr_url": qr_url,
        })

    def _2fa_verify(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        code = (data.get("code") or "").strip()
        row = db.get_2fa(me["id"])
        if not row:
            return json_response(self, 400, {"error": "no_setup"})
        if not totp.verify_totp(row["secret"], code):
            return json_response(self, 400, {"error": "invalid_code"})
        codes = totp.generate_backup_codes(8)
        db.enable_2fa(me["id"], codes)
        return json_response(self, 200, {"ok": True, "backup_codes": codes})

    def _2fa_disable(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        password = data.get("password") or ""
        if not auth.verify_password(password, me["password_hash"], me["salt"]):
            return json_response(self, 400, {"error": "invalid_password"})
        db.disable_2fa(me["id"])
        return json_response(self, 200, {"ok": True})

    def _2fa_verify_login(self):
        """Second step of login when 2FA is enabled.

        Deletes the temporary 5-minute session, verifies the code,
        and creates a fresh 30-day session.
        """
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get(COOKIE_NAME)
        if not morsel:
            return json_response(self, 401, {"error": "not_authenticated"})
        sess = db.get_session(morsel.value)
        if not sess:
            return json_response(self, 401, {"error": "not_authenticated"})
        me = db.get_user_by_id(sess["user_id"])
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})

        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        code = (data.get("code") or "").strip()

        row = db.get_2fa(me["id"])
        if not row or not row["enabled"]:
            return json_response(self, 400, {"error": "2fa_not_enabled"})

        # Try TOTP
        ok = False
        used_backup = False
        if totp.verify_totp(row["secret"], code):
            ok = True
        elif db.consume_backup_code(me["id"], code):
            ok = True
            used_backup = True

        if not ok:
            return json_response(self, 400, {"error": "invalid_code"})

        # Delete the temporary session
        db.delete_session(morsel.value)

        # Create new 30-day session
        new_token = auth.new_session_token()
        db.create_session(new_token, me["id"], db.now() + auth.SESSION_TTL)

        return json_response(
            self, 200,
            {"ok": True, "used_backup": used_backup, "user": private_user(me)},
            extra_headers=[make_set_cookie(new_token, auth.SESSION_TTL)],
        )


    def _delete_notification(self, notification_id):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        db.delete_notification(notification_id, me["id"])
        return json_response(self, 200, {"ok": True})

    def _update_settings(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        db.update_settings(me["id"], data)
        return json_response(self, 200, {"settings": db.get_settings(me["id"])})

    def _change_password(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        current = data.get("current_password") or ""
        new = data.get("new_password") or ""
        if len(new) < 6:
            return json_response(self, 400, {"error": "password_too_short"})
        if not auth.verify_password(current, me["password_hash"], me["salt"]):
            return json_response(self, 400, {"error": "invalid_current_password"})
        pwd_hash, salt = auth.hash_password(new)
        conn = db.get_conn()
        try:
            conn.execute(
                "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
                (pwd_hash, salt, me["id"]),
            )
            conn.commit()
        finally:
            conn.close()
        return json_response(self, 200, {"ok": True})

    def _create_post(self):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        body = (data.get("body") or "").strip()
        title = (data.get("title") or "").strip()
        kind = data.get("kind") or "short"
        cover = (data.get("cover") or "").strip()
        tags = (data.get("tags") or "").strip()
        is_draft = bool(data.get("draft"))
        visibility = data.get("visibility") or "public"
        if visibility not in ("public", "followers", "private"):
            visibility = "public"
        if not body:
            return json_response(self, 400, {"error": "missing_body"})
        if kind not in ("short", "article"):
            kind = "short"
        if kind == "short" and len(body) > 500:
            return json_response(self, 400, {"error": "short_too_long"})
        if kind == "article" and not title:
            return json_response(self, 400, {"error": "missing_title"})
        pid, slug = db.create_post(me["id"], title, body, kind, cover, tags, is_draft)
        # set visibility
        if visibility != "public":
            db.update_post_visibility(pid, visibility)
        return json_response(self, 201, {"id": pid, "slug": slug})


    def _get_post(self, slug):
        post = db.get_post_by_slug(slug)
        if not post:
            return json_response(self, 404, {"error": "post_not_found"})

        me = current_user(self)
        is_author = bool(me and me["id"] == post["author_id"])

        # Draft check
        if post["is_draft"] and not is_author:
            return json_response(self, 404, {"error": "post_not_found"})

        # Visibility check
        visibility = post.get("visibility") or "public"
        if not is_author:
            if visibility == "private":
                return json_response(self, 404, {"error": "post_not_found"})
            if visibility == "followers":
                if not me or not db.is_following(me["id"], post["author_id"]):
                    return json_response(self, 403, {"error": "followers_only"})

        # Increment views (safe)
        try:
            db.increment_post_views(post["id"])
        except Exception:
            pass

        # Compute total counts (real + extra)
        try:
            post["likes"] = db.real_like_count(post["id"])
            post["comments"] = db.real_comment_count(post["id"])
            post["bookmarks"] = db.real_bookmark_count(post["id"])
            post["views"] = db.real_view_count(post["id"])
        except Exception:
            pass

        post["liked"] = bool(me and db.is_post_liked(post["id"], me["id"]))
        post["bookmarked"] = bool(me and db.is_post_bookmarked(post["id"], me["id"]))
        return json_response(self, 200, {"post": post})

    def _update_post(self, slug):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        post = db.get_post_by_slug(slug)
        if not post:
            return json_response(self, 404, {"error": "post_not_found"})
        if post["author_id"] != me["id"]:
            return json_response(self, 403, {"error": "not_author"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        db.update_post(
            post["id"],
            title=data.get("title"),
            body=data.get("body"),
            cover=data.get("cover"),
            tags=data.get("tags"),
            kind=data.get("kind"),
            is_draft=data.get("draft"),
        )
        return json_response(self, 200, {"ok": True})

    def _delete_post(self, slug):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        post = db.get_post_by_slug(slug)
        if not post:
            return json_response(self, 404, {"error": "post_not_found"})
        if post["author_id"] != me["id"]:
            return json_response(self, 403, {"error": "not_author"})
        db.delete_post(post["id"])
        return json_response(self, 200, {"ok": True})

    def _toggle_post_like(self, slug):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        post = db.get_post_by_slug(slug)
        if not post:
            return json_response(self, 404, {"error": "post_not_found"})
        liked = db.toggle_post_like(post["id"], me["id"])
        return json_response(self, 200, {
            "liked": liked,
            "likes": db.real_like_count(post["id"]),
        })

    def _toggle_post_bookmark(self, slug):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        post = db.get_post_by_slug(slug)
        if not post:
            return json_response(self, 404, {"error": "post_not_found"})
        bookmarked = db.toggle_post_bookmark(post["id"], me["id"])
        return json_response(self, 200, {"bookmarked": bookmarked})

    def _list_post_comments(self, slug):
        post = db.get_post_by_slug(slug)
        if not post:
            return json_response(self, 404, {"error": "post_not_found"})
        me = current_user(self)
        comments = db.list_post_comments(post["id"])
        for c in comments:
            c["likes"] = db.count_comment_likes(c["id"])
            c["liked"] = bool(me and db.is_comment_liked(c["id"], me["id"]))
            c["bookmarked"] = bool(me and db.is_comment_bookmarked(c["id"], me["id"]))
            # can_delete: comment author OR post author
            c["can_delete"] = bool(
                me and (c["author_id"] == me["id"] or post["author_id"] == me["id"])
            )
        return json_response(self, 200, {"comments": comments})

    def _add_post_comment(self, slug):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        post = db.get_post_by_slug(slug)
        if not post:
            return json_response(self, 404, {"error": "post_not_found"})
        data = read_json_body(self)
        if not data or not (data.get("body") or "").strip():
            return json_response(self, 400, {"error": "empty_comment"})
        db.add_post_comment(post["id"], me["id"], data["body"].strip())
        if post["author_id"] != me["id"]:
            db.create_notification(
            post["author_id"], me["id"], "post_comment",
            detail=post["title"] or post["slug"],
            target_type="post", target_id=post["slug"]  # slug as text
        )
        return json_response(self, 201, {"ok": True})

    def _get_social(self, owner, name):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        me = current_user(self)
        data = {
            "stars": db.count_stars(r["id"]),
            "watches": db.count_watches(r["id"]),
            "forks": db.count_forks(r["id"]),
            "starred": False,
            "watching": False,
        }
        if me:
            data["starred"] = db.is_starred(me["id"], r["id"])
            data["watching"] = db.is_watching(me["id"], r["id"])
        return json_response(self, 200, data)

    def _toggle_star(self, owner, name):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        starred = db.toggle_star(me["id"], r["id"])
        if starred:
            db.log_activity(me["id"], r["id"], "star")
            db.create_notification(r["owner_id"], me["id"], "star", r["id"], target_type="repo", target_id=r["id"])
        return json_response(self, 200, {
            "starred": starred,
            "stars": db.count_stars(r["id"]),
        })

    def _toggle_watch(self, owner, name):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        watching = db.toggle_watch(me["id"], r["id"])
        if watching:
            db.log_activity(me["id"], r["id"], "watch")
        return json_response(self, 200, {
            "watching": watching,
            "watches": db.count_watches(r["id"]),
        })

    def _list_issues(self, owner, name, qs):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        state = qs.get("state", ["open"])[0]
        issues = db.list_issues(r["id"], state=state)
        return json_response(self, 200, {"state": state, "issues": issues})

    def _get_issue(self, owner, name, number):
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        issue = db.get_issue(r["id"], number)
        if not issue:
            return json_response(self, 404, {"error": "issue_not_found"})
        comments = db.list_issue_comments(issue["id"])
        return json_response(self, 200, {"issue": issue, "comments": comments})

    def _create_issue(self, owner, name):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})
        title = (data.get("title") or "").strip()
        body = data.get("body") or ""
        if not title:
            return json_response(self, 400, {"error": "missing_title"})

        # 1. Create issue
        issue_id = db.create_issue(r["id"], me["id"], title, body)

        # 2. Get the created issue (for number)
        issues = db.list_issues(r["id"], state="all")
        created = None
        for it in issues:
            if it["id"] == issue_id:
                created = it
                break

        # 3. Log + notify
        db.log_activity(me["id"], r["id"], "issue", title)
        if created and r["owner_id"] != me["id"]:
            db.create_notification(
                r["owner_id"], me["id"], "issue", r["id"], title,
                target_type="issue", target_id=created["number"]
            )
        return json_response(self, 201, {
            "ok": True,
            "id": issue_id,
            "number": created["number"] if created else None,
        })


    def _add_comment(self, owner, name, number):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        issue = db.get_issue(r["id"], number)
        if not issue:
            return json_response(self, 404, {"error": "issue_not_found"})
        data = read_json_body(self)
        if not data or not (data.get("body") or "").strip():
            return json_response(self, 400, {"error": "empty_comment"})
        db.add_issue_comment(issue["id"], me["id"], data["body"])
        if issue["author_id"] != me["id"]:
            db.create_notification(
            issue["author_id"], me["id"], "comment", r["id"], issue["title"],
            target_type="issue", target_id=issue["number"]
        )
        return json_response(self, 201, {"ok": True})

    def _get_contents(self, owner, name, qs):
        """Return either a directory listing or file metadata.

        Directory check comes first, because git show on a directory name
        returns a tree listing as text, which would be mistaken for a file.
        """
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        branch = qs.get("branch", [r["default_branch"]])[0]
        path = qs.get("path", [""])[0].strip("/")

        if path == "":
            is_dir = True
        else:
            parent = os.path.dirname(path)
            parent_entries = git_ops.list_tree(
                owner, name, branch, parent
            ) if parent else git_ops.list_tree(owner, name, branch, "")
            name_only = os.path.basename(path)
            is_dir = any(
                e["name"] == name_only and e["type"] == "tree"
                for e in parent_entries
            )

        if is_dir:
            entries = git_ops.list_tree(owner, name, branch, path)
            return json_response(self, 200, {
                "type": "dir",
                "branch": branch,
                "path": path,
                "entries": entries,
            })

        content = git_ops.read_blob(owner, name, branch, path)
        if content is not None:
            return json_response(self, 200, {
                "type": "file",
                "branch": branch,
                "path": path,
                "name": os.path.basename(path),
                "content": content,
            })

        return json_response(self, 404, {"error": "path_not_found"})

    def _get_raw(self, owner, name, qs):
        """Return raw file bytes for download/inline display."""
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        branch = qs.get("branch", [r["default_branch"]])[0]
        path = qs.get("path", [""])[0]
        if not path:
            return json_response(self, 400, {"error": "missing_path"})

        # Get blob sha via ls-tree
        entries = git_ops.list_tree(owner, name, branch, "")
        sha = None
        target_dir = os.path.dirname(path)
        target_name = os.path.basename(path)

        # If path is inside a dir, we need to walk
        if target_dir:
            parts = target_dir.split("/")
            cur = ""
            for part in parts:
                found = None
                for e in git_ops.list_tree(owner, name, branch, cur):
                    if e["name"] == part and e["type"] == "tree":
                        found = e["path"]
                        break
                if not found:
                    return json_response(self, 404, {"error": "path_not_found"})
                cur = found
            entries = git_ops.list_tree(owner, name, branch, cur)

        for e in entries:
            if e["name"] == target_name and e["type"] == "blob":
                sha = e["sha"]
                break

        if not sha:
            return json_response(self, 404, {"error": "blob_not_found"})

        # Use git cat-file to get raw bytes
        repo_path = git_ops.repo_path(owner, name)
        try:
            out = subprocess.run(
                ["git", "cat-file", "blob", sha],
                cwd=repo_path, check=True, capture_output=True,
            )
            data = out.stdout
        except subprocess.CalledProcessError:
            return json_response(self, 404, {"error": "blob_not_found"})

        # Guess content-type from extension
        ext = os.path.splitext(path)[1].lower()
        ctypes = {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
            ".ico": "image/x-icon", ".bmp": "image/bmp",
            ".pdf": "application/pdf",
            ".woff": "font/woff", ".woff2": "font/woff2",
            ".ttf": "font/ttf", ".otf": "font/otf",
            ".zip": "application/zip", ".gz": "application/gzip",
            ".tar": "application/x-tar",
        }
        ctype = ctypes.get(ext, "application/octet-stream")

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=3600")
        self._cors()
        self.end_headers()
        self.wfile.write(data)

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

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        # Check write scope for token-based auth
        if path != "/api/auth/login" and path != "/api/auth/signup":
            me = current_user(self)
            if me and not require_write(self, me):
                return json_response(self, 403, {"error": "insufficient_scope"})
        try:
            return self._route_post(path)
        except Exception as e:
            json_response(self, 500, {"error": "server_error", "detail": str(e)})

    def _route_post(self, path):

        m = re.match(r"^/api/comments/(\d+)/like$", path)
        if m:
            return self._toggle_comment_like(int(m.group(1)))

        m = re.match(r"^/api/comments/(\d+)/bookmark$", path)
        if m:
            return self._toggle_comment_bookmark(int(m.group(1)))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/branches$", path)
        if m:
            return self._create_branch(m.group(1), m.group(2))

        if path == "/api/users/me/avatar":
            return self._upload_avatar()

        if path == "/api/users/me/username":
            return self._change_username()

        if path == "/api/tokens":
            return self._create_token()

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/releases$", path)
        if m:
            return self._create_release(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/releases/(\d+)/assets$", path)
        if m:
            return self._upload_asset(m.group(1), m.group(2), int(m.group(3)))

        if path == "/api/posts":
            return self._create_post()

        m = re.match(r"^/api/posts/([^/]+)/like$", path)
        if m:
            return self._toggle_post_like(m.group(1))

        m = re.match(r"^/api/posts/([^/]+)/bookmark$", path)
        if m:
            return self._toggle_post_bookmark(m.group(1))

        m = re.match(r"^/api/posts/([^/]+)/comments$", path)
        if m:
            return self._add_post_comment(m.group(1))

        if path == "/api/settings":
            return self._update_settings()

        if path == "/api/users/me/password":
            return self._change_password()

        if path == "/api/2fa/setup":
            return self._2fa_setup()

        if path == "/api/2fa/verify":
            return self._2fa_verify()

        if path == "/api/2fa/disable":
            return self._2fa_disable()

        if path == "/api/2fa/verify-login":
            return self._2fa_verify_login()

        # User follow routes
        m = re.match(r"^/api/users/([^/]+)/follow$", path)
        if m:
            return self._follow(m.group(1))

        m = re.match(r"^/api/users/me/profile$", path)
        if m:
            return self._update_profile()

        if path == "/api/notifications/clear":
            me = current_user(self)
            if not me:
                return json_response(self, 401, {"error": "not_authenticated"})
            db.clear_notifications(me["id"])
            return json_response(self, 200, {"ok": True})

        if path == "/api/notifications/read":
            return self._mark_notifications_read()

        if path == "/api/auth/signup":
            return self._signup()
        if path == "/api/auth/login":
            return self._login()
        if path == "/api/auth/logout":
            return self._logout()
        if path == "/api/repos":
            return self._create_repo()

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/issues$", path)
        if m:
            return self._create_issue(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/issues/(\d+)/comments$", path)
        if m:
            return self._add_comment(m.group(1), m.group(2), int(m.group(3)))

        m = re.match(r"^/api/posts/([^/]+)$", path)
        if m:
            return self._delete_post(m.group(1))


        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/file$", path)
        if m:
            return self._save_file(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/push$", path)
        if m:
            return self._push(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/fork$", path)
        if m:
            return self._fork(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/star$", path)
        if m:
            return self._toggle_star(m.group(1), m.group(2))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/watch$", path)
        if m:
            return self._toggle_watch(m.group(1), m.group(2))

        return json_response(self, 404, {"error": "not_found", "path": path})

    def _signup(self):
        if not config.allow_signup():
            return json_response(self, 403, {"error": "signup_disabled"})
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

        # Check 2FA
        twofa = db.get_2fa(u["id"])
        if twofa and twofa["enabled"]:
            # Create a short-lived session marked as 2fa_pending
            token = auth.new_session_token()
            db.create_session(token, u["id"], db.now() + 300)  # 5 min
            return json_response(
                self, 200,
                {"requires_2fa": True},
                extra_headers=[make_set_cookie(token, 300)],
            )

        token = auth.new_session_token()
        db.create_session(token, u["id"], db.now() + auth.SESSION_TTL)
        json_response(
            self, 200,
            {"user": private_user(u)},
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
        max_repos = config.get("max_repos_per_user", 50)
        user_repos = db.list_repos_by_owner(me["id"], include_private=True)
        if len(user_repos) >= max_repos:
            return json_response(self, 400, {"error": "repo_limit_reached"})
        data = read_json_body(self)
        if data is None:
            return json_response(self, 400, {"error": "invalid_json"})
        name = (data.get("name") or "").strip()
        description = (data.get("description") or "").strip()
        is_private = 1 if (data.get("private") and config.allow_private()) else 0

        if not REPO_RE.match(name):
            return json_response(self, 400, {"error": "invalid_repo_name"})
        if db.get_repo(me["username"], name):
            return json_response(self, 409, {"error": "repo_exists"})

        git_ops.create_repo(me["username"], name)
        rid = db.create_repo(me["id"], name, description, is_private)
        db.log_activity(me["id"], rid, "create_repo", name)
        r = db.get_repo(me["username"], name)
        r["owner_username"] = me["username"]
        return json_response(self, 201, {"repo": public_repo(r)})

    def _fork(self, owner, name):
        if not config.allow_forks():
            return json_response(self, 403, {"error": "forks_disabled"})
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
        db.log_activity(me["id"], r["id"], "fork", "forked from %s/%s" % (owner, name))
        return json_response(self, 201, {"repo": public_repo(r)})

    def _save_file(self, owner, name):
        """Create or update a file with a commit."""
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})

        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})

        path = (data.get("path") or "").strip("/")
        content = data.get("content", "")
        message = (data.get("message") or "").strip() or ("Update " + path)
        if not path:
            return json_response(self, 400, {"error": "missing_path"})

        try:
            result = git_ops.commit_file(
                owner, name, path, content, message,
                me["username"], me.get("email") or (me["username"] + "@gitcode.local"),
            )
        except Exception as e:
            return json_response(self, 500, {"error": "commit_failed", "detail": str(e)})

        db.update_repo_timestamp(r["id"])
        db.log_activity(me["id"], r["id"], "commit", message)
        return json_response(self, 200, result)

    def _delete_file(self, owner, name):
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})

        data = read_json_body(self)
        if not data:
            return json_response(self, 400, {"error": "invalid_json"})

        path = (data.get("path") or "").strip("/")
        message = (data.get("message") or "").strip() or ("Delete " + path)
        if not path:
            return json_response(self, 400, {"error": "missing_path"})

        try:
            result = git_ops.delete_file(
                owner, name, path, message,
                me["username"], me.get("email") or (me["username"] + "@gitcode.local"),
            )
        except Exception as e:
            return json_response(self, 500, {"error": "delete_failed", "detail": str(e)})

        db.update_repo_timestamp(r["id"])
        return json_response(self, 200, result)

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

    def do_PATCH(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/issues/(\d+)$", path)
        if m:
            return self._update_issue(m.group(1), m.group(2), int(m.group(3)))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)$", path)
        if not m:
            return json_response(self, 404, {"error": "not_found"})
        me = current_user(self)
        if not me:
            return json_response(self, 401, {"error": "not_authenticated"})
        owner, name = m.group(1), m.group(2)
        if me["username"].lower() != owner.lower():
            return json_response(self, 403, {"error": "not_owner"})
        r = db.get_repo(owner, name)
        if not r:
            return json_response(self, 404, {"error": "repo_not_found"})
        data = read_json_body(self)
        if data is None:
            return json_response(self, 400, {"error": "invalid_json"})
        db.update_repo(r["id"], data)
        updated = db.get_repo(owner, name)
        updated["owner_username"] = owner
        return json_response(self, 200, {"repo": public_repo(updated)})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        me = current_user(self)
        if me and not require_write(self, me):
            return json_response(self, 403, {"error": "insufficient_scope"})

        m = re.match(r"^/api/notifications/(\d+)$", path)
        if m:
            return self._delete_notification(int(m.group(1)))

        m = re.match(r"^/api/comments/(\d+)$", path)
        if m:
            return self._delete_comment(int(m.group(1)))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/file$", path)
        if m:
            return self._delete_file(m.group(1), m.group(2))

        m = re.match(r"^/api/users/([^/]+)/follow$", path)
        if m:
            return self._unfollow(m.group(1))

        m = re.match(r"^/api/tokens/(\d+)$", path)
        if m:
            return self._delete_token(int(m.group(1)))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/releases/(\d+)$", path)
        if m:
            return self._delete_release(m.group(1), m.group(2), int(m.group(3)))

        m = re.match(r"^/api/repos/([^/]+)/([^/]+)/branches/([^/]+)$", path)
        if m:
            return self._delete_branch(m.group(1), m.group(2), m.group(3))

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

    import ssl, os as _os
    cert_path = _os.path.join(HERE, "..", "certs", "cert.pem")
    key_path = _os.path.join(HERE, "..", "certs", "key.pem")
    use_https = _os.path.isfile(cert_path) and _os.path.isfile(key_path)

    server = HTTPServer(("0.0.0.0", PORT), Handler)

    if use_https:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        print("GitCode API on https://localhost:%d" % PORT)
    else:
        print("GitCode API on http://localhost:%d" % PORT)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")
        server.shutdown()


if __name__ == "__main__":
    main()
