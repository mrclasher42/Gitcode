# GitCode

A lightweight self-hosted Git platform, built from scratch in Python.

GitCode stores real git repositories on disk and serves them through a
small HTTP server. Designed to run on Termux / Android without root.

## Goals

- Real git repositories, not a mock
- Minimal dependencies: Python 3, git CLI, SQLite
- Cookie-based sessions, hashlib password hashing
- Clean, responsive web interface
- Runs offline

## Non-goals

- GitHub API compatibility
- CI/CD pipelines
- SSH server
- Real-time collaboration
- OAuth

## Status

Early development. See `docs/roadmap.md`.

## Requirements

- Python 3.8+
- `git` in PATH
- SQLite (bundled with Python)

## Run

    python server.py
    # http://localhost:8080/

## Layout

    gitcode/
    ├── server.py
    ├── db.py
    ├── auth.py
    ├── git_ops.py
    ├── templates/
    ├── static/
    ├── repos/
    ├── data/
    └── docs/

## License

MIT. See LICENSE.
