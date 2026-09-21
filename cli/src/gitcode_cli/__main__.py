#!/usr/bin/env python3
"""GitCode CLI - gc"""
import os
import sys
import json
import argparse
import getpass
import subprocess
import tempfile
import urllib.request
import ssl
import urllib.error
from urllib.parse import urlparse

CONFIG_DIR = os.path.expanduser("~/.gitcode")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config")


def load_config():
    if not os.path.isfile(CONFIG_FILE):
        return {}
    with open(CONFIG_FILE) as f:
        return json.load(f)


def save_config(cfg):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)
    os.chmod(CONFIG_FILE, 0o600)


def require_config():
    cfg = load_config()
    if not cfg.get("server") or not cfg.get("token"):
        print("error: not logged in. run: gc login", file=sys.stderr)
        sys.exit(1)
    return cfg


def api_request(cfg, method, path, data=None, raw_body=None, raw_ctype=None):
    url = cfg["server"].rstrip("/") + path
    tok = cfg["token"]
    headers = {}
    if tok.startswith("gc_"):
        headers["Authorization"] = "Bearer " + tok
    else:
        headers["Cookie"] = "gc_session=" + tok
    body = None

    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif raw_body is not None:
        body = raw_body
        if raw_ctype:
            headers["Content-Type"] = raw_ctype

    req = urllib.request.Request(url, data=body, method=method, headers=headers)

    try:
        with urllib.request.urlopen(req, context=ssl._create_unverified_context()) as resp:
            raw = resp.read()
            ctype = resp.headers.get("Content-Type", "")
            if "application/json" in ctype:
                return json.loads(raw.decode("utf-8")), resp
            return raw, resp
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            err = json.loads(raw.decode("utf-8"))
        except Exception:
            err = {"error": raw.decode("utf-8", "replace")}
        print("error: HTTP %d %s" % (e.code, err), file=sys.stderr)
        sys.exit(1)


# ---------- commands ----------

def cmd_login(args):
    server = args.server or input("Server URL [http://localhost:8080]: ").strip() \
             or "http://localhost:8080"
    username = args.username or input("Username: ").strip()
    if args.password:
        password = args.password
    else:
        try:
            password = getpass.getpass("Password: ").strip()
        except Exception:
            import sys as _sys
            _sys.stderr.write("Password: ")
            _sys.stderr.flush()
            password = _sys.stdin.readline().rstrip("\n").strip()

    payload = json.dumps({"username": username, "password": password}).encode()
    req = urllib.request.Request(
        server.rstrip("/") + "/api/auth/login",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, context=ssl._create_unverified_context()) as resp:
            set_cookie = resp.headers.get("Set-Cookie", "")
            token = ""
            for part in set_cookie.split(";"):
                part = part.strip()
                if part.startswith("gc_session="):
                    token = part[len("gc_session="):]
                    break
            if not token:
                print("error: no session cookie returned", file=sys.stderr)
                sys.exit(1)
            save_config({"server": server.rstrip("/"), "token": token,
                         "username": username})
            print("Logged in as %s at %s" % (username, server))
    except urllib.error.HTTPError as e:
        print("error: login failed (%d)" % e.code, file=sys.stderr)
        sys.exit(1)


def cmd_logout(args):
    cfg = load_config()
    if cfg.get("server") and cfg.get("token"):
        try:
            api_request(cfg, "POST", "/api/auth/logout")
        except SystemExit:
            pass
    if os.path.isfile(CONFIG_FILE):
        os.remove(CONFIG_FILE)
    print("Logged out.")


def cmd_whoami(args):
    cfg = require_config()
    data, _ = api_request(cfg, "GET", "/api/auth/me")
    print(data["user"]["username"])


def cmd_config(args):
    cfg = load_config()
    if args.action == "set" and args.key:
        cfg[args.key] = args.value
        save_config(cfg)
        print("Set %s." % args.key)
    else:
        safe = {k: ("***" if k == "token" else v) for k, v in cfg.items()}
        print(json.dumps(safe, indent=2))


def cmd_create(args):
    cfg = require_config()
    data, _ = api_request(cfg, "POST", "/api/repos", {
        "name": args.name,
        "description": args.description or "",
        "private": bool(args.private),
    })
    r = data["repo"]
    print("Created %s/%s" % (r["owner_username"], r["name"]))
    print("  git remote add origin %s/%s/%s" % (cfg["server"], r["owner_username"], r["name"]))
    print("  then: gc push")


def cmd_list(args):
    cfg = require_config()
    data, _ = api_request(cfg, "GET", "/api/repos")
    for r in data["repos"]:
        vis = "private" if r["is_private"] else "public "
        print("%s  %s/%s  %s" % (vis, r["owner_username"], r["name"],
                                 r.get("description", "")))


def cmd_push(args):
    cfg = require_config()
    # Read the current git repo
    try:
        remote_url = subprocess.check_output(
            ["git", "config", "--get", "remote.origin.url"],
            text=True, stderr=subprocess.DEVNULL,
        ).strip()
    except subprocess.CalledProcessError:
        remote_url = args.remote or ""
        if not remote_url:
            print("error: no remote.origin.url and no remote specified", file=sys.stderr)
            sys.exit(1)

    # Parse owner/repo from URL, e.g. http://host/user/repo or user/repo
    parts = [p for p in urlparse(remote_url).path.split("/") if p]
    if len(parts) < 2:
        parts = remote_url.split("/")
    if len(parts) < 2:
        print("error: cannot parse owner/repo from %s" % remote_url, file=sys.stderr)
        sys.exit(1)
    owner, repo = parts[-2], parts[-1]

    # Create a git bundle of all refs
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".bundle")
    tmp.close()
    try:
        subprocess.run(
            ["git", "bundle", "create", tmp.name, "--all"],
            check=True, capture_output=True,
        )
        with open(tmp.name, "rb") as f:
            data = f.read()
        print("Uploading %d bytes to %s/%s..." % (len(data), owner, repo))
        api_request(
            cfg, "POST",
            "/api/repos/%s/%s/push" % (owner, repo),
            raw_body=data, raw_ctype="application/octet-stream",
        )
        print("Done.")
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass




def cmd_fork(args):
    cfg = require_config()
    owner, repo = args.repo.split("/", 1)
    data, _ = api_request(cfg, "POST",
                          "/api/repos/%s/%s/fork" % (owner, repo))
    r = data["repo"]
    print("Forked to %s/%s" % (r["owner_username"], r["name"]))
    if "fork" in r:
        print("  from %s/%s" % (r["fork"]["parent_owner"], r["fork"]["parent_name"]))
    print("  gc clone %s/%s" % (r["owner_username"], r["name"]))


def cmd_token(args):
    cfg = require_config()
    if args.action == "new":
        name = args.value or "cli"
        data, _ = api_request(cfg, "POST", "/api/tokens", {"name": name})
        print("Token created:")
        print("  " + data["token"])
        print("")
        print("Use in your config:")
        print("  gc config set token " + data["token"])
    elif args.action == "list":
        data, _ = api_request(cfg, "GET", "/api/tokens")
        for t in data["tokens"]:
            print("  [%d] %s (%s)" % (t["id"], t["name"], t["scopes"]))
    elif args.action == "delete":
        api_request(cfg, "DELETE", "/api/tokens/" + str(args.value))
        print("Deleted.")


def cmd_clone(args):
    cfg = require_config()
    repo_arg = args.repo

    # Support full URL
    if repo_arg.startswith("http://") or repo_arg.startswith("https://"):
        from urllib.parse import urlparse as _urlparse
        parsed = _urlparse(repo_arg)
        cfg["server"] = "%s://%s" % (parsed.scheme, parsed.netloc)
        path = parsed.path.strip("/")
        if path.endswith(".git"):
            path = path[:-4]
        parts = path.split("/")
        if len(parts) >= 2:
            owner, repo = parts[-2], parts[-1]
        else:
            print("error: cannot parse owner/repo", file=sys.stderr)
            sys.exit(1)
    else:
        owner, repo = repo_arg.split("/", 1)

    url = "%s/api/repos/%s/%s/bundle" % (cfg["server"], owner, repo)
    req = urllib.request.Request(
        url, headers={"Cookie": "gc_session=" + cfg["token"]},
    )
    try:
        with urllib.request.urlopen(req, context=ssl._create_unverified_context()) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        print("error: %d" % e.code, file=sys.stderr)
        sys.exit(1)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".bundle")
    tmp.write(data)
    tmp.close()
    try:
        subprocess.run(["git", "clone", tmp.name, repo], check=True)
        # FIX: set origin to the real server URL
        repo_dir = os.path.join(os.getcwd(), repo)
        real_origin = "%s/%s/%s" % (cfg["server"], owner, repo)
        subprocess.run(
            ["git", "remote", "set-url", "origin", real_origin],
            cwd=repo_dir, check=True,
        )
        print("Cloned into ./%s" % repo)
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass



def build_parser():
    p = argparse.ArgumentParser(prog="gc", description="GitCode CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("login", help="Log in to a GitCode server")
    sp.add_argument("--server")
    sp.add_argument("--username")
    sp.add_argument("--password")
    sp.set_defaults(func=cmd_login)

    sp = sub.add_parser("logout", help="Log out")
    sp.set_defaults(func=cmd_logout)

    sp = sub.add_parser("whoami", help="Show current user")
    sp.set_defaults(func=cmd_whoami)

    sp = sub.add_parser("token", help="Manage API tokens")
    sp.add_argument("action", choices=["new", "list", "delete"])
    sp.add_argument("value", nargs="?")
    sp.set_defaults(func=cmd_token)

    sp = sub.add_parser("config", help="Show or set config")
    sp.add_argument("action", nargs="?", choices=["get", "set"], default="get")
    sp.add_argument("key", nargs="?")
    sp.add_argument("value", nargs="?")
    sp.set_defaults(func=cmd_config)

    sp = sub.add_parser("create", help="Create a repository")
    sp.add_argument("name")
    sp.add_argument("-d", "--description", default="")
    sp.add_argument("--private", action="store_true")
    sp.set_defaults(func=cmd_create)

    sp = sub.add_parser("list", help="List repositories")
    sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("push", help="Push current repo to server")
    sp.add_argument("-r", "--remote", default=None)
    sp.set_defaults(func=cmd_push)

    sp = sub.add_parser("fork", help="Fork a repository")
    sp.add_argument("repo", help="owner/repo")
    sp.set_defaults(func=cmd_fork)

    sp = sub.add_parser("clone", help="Clone a repository")
    sp.add_argument("repo", help="owner/repo")
    sp.set_defaults(func=cmd_clone)

    return p


def main():
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
