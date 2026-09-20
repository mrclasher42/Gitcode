"""Git operations via subprocess. All repos live under ../repos/<user>/<repo>.git/"""
import os
import subprocess
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
REPOS_DIR = os.path.abspath(os.path.join(ROOT, "..", "repos"))


def repo_path(username, name):
    return os.path.join(REPOS_DIR, username, name + ".git")


def _run(cwd, *args, check=True):
    return subprocess.run(
        ["git"] + list(args),
        cwd=cwd,
        check=check,
        capture_output=True,
        text=True,
    )


def create_repo(username, name, default_branch="main"):
    """Create a bare repository on disk."""
    path = repo_path(username, name)
    os.makedirs(path, exist_ok=True)
    _run(path, "init", "--bare", "--initial-branch=" + default_branch)
    return path


def delete_repo(username, name):
    path = repo_path(username, name)
    if os.path.isdir(path):
        shutil.rmtree(path)


def list_branches(username, name):
    path = repo_path(username, name)
    if not os.path.isdir(path):
        return []
    try:
        out = _run(path, "for-each-ref", "--format=%(refname:short)", "refs/heads")
        return [b for b in out.stdout.splitlines() if b]
    except subprocess.CalledProcessError:
        return []


def list_commits(username, name, branch="main", limit=50):
    path = repo_path(username, name)
    if not os.path.isdir(path):
        return []
    try:
        out = _run(
            path, "log", branch,
            "-n", str(limit),
            "--pretty=format:%H%x09%an%x09%ae%x09%at%x09%s",
        )
        commits = []
        for line in out.stdout.splitlines():
            parts = line.split("\t", 4)
            if len(parts) == 5:
                commits.append({
                    "sha": parts[0],
                    "author_name": parts[1],
                    "author_email": parts[2],
                    "timestamp": int(parts[3]),
                    "message": parts[4],
                })
        return commits
    except subprocess.CalledProcessError:
        return []


def list_tree(username, name, branch="main", path=""):
    """List tree entries at path."""
    repo = repo_path(username, name)
    if not os.path.isdir(repo):
        return []
    try:
        args = ["ls-tree", "-z", branch + (":" + path if path else "")]
        out = _run(repo, *args)
        entries = []
        for item in out.stdout.split("\0"):
            if not item:
                continue
            meta, fname = item.split("\t", 1)
            mode, typ, sha = meta.split(" ", 2)
            entries.append({
                "name": fname,
                "type": "tree" if typ == "tree" else "blob",
                "mode": mode,
                "sha": sha,
                "path": (path + "/" + fname) if path else fname,
            })
        entries.sort(key=lambda e: (e["type"] != "tree", e["name"].lower()))
        return entries
    except subprocess.CalledProcessError:
        return []


def read_blob(username, name, branch, path):
    """Return file contents at branch:path, or None."""
    repo = repo_path(username, name)
    if not os.path.isdir(repo):
        return None
    try:
        out = _run(repo, "show", "%s:%s" % (branch, path))
        return out.stdout
    except subprocess.CalledProcessError:
        return None


def repo_size(username, name):
    path = repo_path(username, name)
    if not os.path.isdir(path):
        return 0
    total = 0
    for dirpath, _, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(dirpath, f))
            except OSError:
                pass
    return total


def fork_repo(src_username, src_name, dst_username, dst_name):
    """Clone a bare repo into another bare repo (fork)."""
    src = repo_path(src_username, src_name)
    dst = repo_path(dst_username, dst_name)
    if not os.path.isdir(src):
        raise FileNotFoundError("source repo not found on disk")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    subprocess.run(
        ["git", "clone", "--bare", src, dst],
        check=True, capture_output=True,
    )
    return dst
