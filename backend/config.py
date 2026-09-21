"""Configuration loader for GitCode.

Reads ~/gitcode/CONFIG (simple key = value format).
Values are auto-converted: true/false -> bool, integers -> int, rest -> str.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.abspath(os.path.join(ROOT, "..", "CONFIG"))

_cache = None


def _parse_value(v):
    v = v.strip()
    if v.lower() == "true":
        return True
    if v.lower() == "false":
        return False
    if v.lower() in ("null", "none"):
        return None
    try:
        return int(v)
    except ValueError:
        pass
    return v


def load():
    global _cache
    if _cache is not None:
        return _cache

    cfg = {}
    if not os.path.isfile(CONFIG_PATH):
        _cache = cfg
        return cfg

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, val = line.partition("=")
            cfg[key.strip()] = _parse_value(val)

    _cache = cfg
    return cfg


def get(key, default=None):
    return load().get(key, default)


def reload():
    """Force re-read on next access."""
    global _cache
    _cache = None


# Common shortcuts
def allow_forks():     return get("allow_forks", True)
def allow_delete():    return get("allow_delete", True)
def allow_private():   return get("allow_private", True)
def allow_signup():    return get("allow_signup", True)
def enable_issues():   return get("enable_issues", True)
def session_ttl_days(): return get("session_ttl_days", 30)
def default_branch():  return get("default_branch", "main")
def site_name():       return get("site_name", "GitCode")
