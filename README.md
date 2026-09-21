# GitCode

> A lightweight, self-hosted Git platform — built from scratch in Python and React.

GitCode stores real git repositories on disk and serves them through a small
HTTP API and a modern web interface. No external frameworks, no heavy
dependencies, no cloud lock-in.

[![Status](https://img.shields.io/badge/status-beta-blue.svg)](#status)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org)
[![Node](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-19-61dafb.svg)](https://react.dev)

---

## Table of Contents

- [What is GitCode](#what-is-gitcode)

- [Features](#features)

- [Requirements](#requirements)

- [Installation](#installation)

- [Configuration](#configuration)

- [HTTPS Setup](#https-setup)

- [CLI Reference](#cli-reference)

- [Project Layout](#project-layout)

- [Architecture](#architecture)

- [API Overview](#api-overview)

- [Roadmap](#roadmap)

- [Development](#development)

- [Contributing](#contributing)

- [License](#license)

- [Acknowledgments](#acknowledgments)

---

## What is GitCode

GitCode is a **complete Git hosting platform** that you run yourself. It
replaces the need for GitHub, GitLab, or Gitea for small projects and personal
use — with a tiny footprint and zero external dependencies beyond Python and
Node.js.

The project is designed around a few principles:

- **Real Git, not a mock.** All repositories are real bare git repos on disk.

- **No frameworks.** Backend uses Python stdlib + `markdown`. Frontend uses
  React and Tailwind, nothing else.

- **Self-contained.** No Docker, no PostgreSQL, no Redis. SQLite + files.

- **Readable.** Every file is meant to be read and understood.

The web interface supports:

- Full repository browsing (tree, files, commits, diffs, branches)

- Issues with comments and state

- Releases with asset uploads

- Posts (short-form and long-form articles)

- A complete settings panel with i18n (English / Arabic) and RTL

- Two-factor authentication

- Personal API tokens

- HTTPS with a self-signed CA

---

## Features

### Git hosting

- **Repositories** — create, delete, configure, mark public or private

- **Forks** — fork any public repository into your account

- **Branches** — create, delete, set the default branch

- **Commits** — full history with per-commit diff view

- **Releases** — attach binary assets with download counters

- **Contributors** — aggregated commit authors per repository

- **File browser** — tree navigation with syntax-aware viewer

- **Line numbers** — optional line numbers in the code viewer

- **Web editor** — edit files in the browser and commit changes

### Issues

- Open, comment on, and close issues

- Per-repository sequential numbering (`#1`, `#2`, ...)

- Comment engagement: likes and bookmarks

- Comment deletion (author or repository owner)

- Notifications to the repository owner

### Posts

- **Short posts** and **long-form articles**

- Markdown rendering with GitHub-style tables

- Likes, bookmarks, and comments

- Comment engagement (likes, bookmarks, delete)

- Post visibility: public, followers-only, private

- Per-user feeds: "For you" and "Following"

### Social

- **Follow** other users (followers / following lists)

- **Star** repositories you like

- **Watch** repositories for updates

- **Activity feed** with recent actions

- **In-app notifications** with unread badge

- **Live counters** formatted as `1.2K`, `1.4M`, etc.

### User accounts

- Signup, login, logout

- Cookie-based sessions (configurable TTL, default 30 days)

- **API tokens** with scopes (`read`, `write`) and expiration

- **Two-factor authentication** (TOTP / Google Authenticator)

- **Backup codes** for 2FA recovery

- **Profile customization** — avatar upload with crop, bio, location, website

- **Change username** at any time

### Settings panel

- **Theme** — light, dark, or follow system

- **Language** — English and Arabic with full RTL support

- **Notifications** — in-app and email preferences

- **Privacy** — default post visibility, public profile, show email

- **Display** — compact mode, line numbers

- **Security** — two-factor authentication, API tokens

- **Account** — edit profile, change password, sign out

### Search

- **Global search** across users, repositories, and code

- **Per-repository search** for file contents

- Filter by type (all / users / repos / code)

### Web interface

- Responsive design — works on mobile and desktop

- Dark and light themes

- Full RTL support for Arabic

- Markdown rendering (README, posts, issues)

- In-app modals and confirmation dialogs

- Custom confirmation dialog (no native browser modals)

- Smooth animations and transitions

### HTTP server

- **HTTPS** with a self-signed local CA

- Auto-detected certificates

- **Cookie and Bearer token** authentication

- CORS-friendly API for local development

- Sub-500 KB static assets (Tailwind, gzipped)

### CLI (`gc`)

- `gc login` / `gc logout` / `gc whoami`

- `gc create` / `gc list` / `gc clone` / `gc push`

- `gc fork` / `gc token`

- Works over HTTPS with self-signed certificates

- Installable via `pip install -e .`

---

## Requirements

| Component | Version |
|-----------|---------|
| Python | 3.8 or newer |
| Node.js | 18 or newer |
| npm | 9 or newer |
| git | any recent version |
| OS | Linux, macOS, or Android (via Termux) |

Optional tools for HTTPS:

- `openssl` for generating the local CA and server certificate

---

## Installation

### 1. Clone the repository

    git clone https://github.com/mrclasher42/Gitcode.git
    cd Gitcode

### 2. Generate HTTPS certificates (optional but recommended)

See [HTTPS Setup](#https-setup).

### 3. Run the backend

    cd backend
    python server.py

    # API listens on https://localhost:8080

### 4. Run the frontend

    cd frontend
    npm install
    npm run dev

    # Web UI on https://localhost:5175

### 5. Install the CLI

    cd cli
    pip install -e .

    gc login
    # Server URL: https://192.168.1.104:8080
    # Username: your-username
    # Password: your-password

### 6. Open the web interface

Visit:

    https://192.168.1.104:5175/

On first run, no users exist. **Sign up** to create your account.

---

## Configuration

GitCode is configured through a single file in the repository root named
`CONFIG`. It uses a simple `key = value` format with `#` for comments. No
YAML, no JSON, no external parser — just readable text.

### Format

    # Comments start with a hash
    key_name = value

    # Booleans
    allow_forks = true
    allow_delete = false

    # Integers
    max_repos_per_user = 50
    session_ttl_days = 30

    # Strings
    site_name = GitCode
    default_branch = main

Values are parsed automatically:

- `true` / `false` → boolean

- `123` → integer

- `hello` → string

- Everything else → string as-is

### Full reference

#### Repository features

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `allow_forks` | bool | `true` | Enable the "Fork" button |
| `allow_delete` | bool | `true` | Allow deleting repositories |
| `allow_private` | bool | `true` | Allow creating private repositories |
| `allow_web_editor` | bool | `true` | Enable the in-browser file editor |
| `allow_signup` | bool | `true` | Allow new user registration |

#### Limits

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `max_repos_per_user` | int | `50` | Maximum repositories per user |
| `max_file_size_kb` | int | `5120` | Maximum upload size in kilobytes |
| `max_description_length` | int | `500` | Maximum description length |
| `max_issues_per_repo` | int | `1000` | Maximum issues per repository |

#### Defaults

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `default_branch` | str | `main` | Default branch for new repositories |
| `default_readme` | str | `README.gc` | Default README filename |

#### Session and security

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `session_ttl_days` | int | `30` | Cookie session lifetime in days |
| `min_password_length` | int | `6` | Minimum password length |
| `max_username_length` | int | `39` | Maximum username length |

#### Interface

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `site_name` | str | `GitCode` | Name shown in the header |
| `site_description` | str | `Self-hosted Git platform` | Short description |
| `items_per_page` | int | `30` | Pagination size |
| `show_watch_button` | bool | `true` | Show the Watch button on repos |
| `show_star_button` | bool | `true` | Show the Star button on repos |
| `show_fork_button` | bool | `true` | Show the Fork button on repos |

#### Future features

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enable_issues` | bool | `true` | Enable the Issues module |
| `enable_pull_requests` | bool | `false` | Enable Pull Requests (planned) |
| `enable_wiki` | bool | `false` | Enable per-repo wiki (planned) |
| `enable_lfs` | bool | `false` | Enable Git LFS (planned) |

### Example `CONFIG`

    # Repository features
    allow_forks = true
    allow_delete = true
    allow_private = true
    allow_web_editor = true
    allow_signup = false

    # Limits
    max_repos_per_user = 100
    max_file_size_kb = 10240

    # Defaults
    default_branch = main
    default_readme = README.gc

    # Session
    session_ttl_days = 30

    # UI
    site_name = GitCode
    site_description = Self-hosted Git platform
    items_per_page = 30

### How it works

- The file is loaded **once at server startup** by `backend/config.py`.

- Changes require a server restart.

- Missing keys fall back to their default values.

- Invalid values are ignored (with a warning in the server log).

- The file is **not** committed as a template. You create it once and it
  stays local.

### Reading CONFIG from Python

    import config

    if config.allow_forks():
        # show the fork button

    days = config.get("session_ttl_days", 30)
    site = config.get("site_name", "GitCode")

### Environment overrides

Override specific values with environment variables:

    PORT=9090 python server.py
    GITCODE_PORT=9090 python server.py

---

## HTTPS Setup

GitCode uses a self-signed CA for HTTPS. Certificates live in `certs/` and
are **not** committed (see `.gitignore`).

### Generate the local CA and server certificate

    mkdir -p certs
    cd certs

    # 1. CA private key
    openssl genrsa -out ca.key 2048

    # 2. CA self-signed certificate
    openssl req -new -x509 -key ca.key -out ca.crt -days 3650 \
      -subj "/C=US/O=GitCode Local CA/CN=GitCode Local CA"

    # 3. Server private key
    openssl genrsa -out key.pem 2048

    # 4. Certificate signing request
    openssl req -new -key key.pem -out server.csr \
      -subj "/C=US/O=GitCode/CN=localhost"

    # 5. Server extensions (SAN)
    cat > server.ext << 'EXTEOF'
    authorityKeyIdentifier=keyid,issuer
    basicConstraints=CA:FALSE
    keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
    subjectAltName = @alt_names

    [alt_names]
    DNS.1 = localhost
    IP.1 = 127.0.0.1
    IP.2 = 192.168.1.104
    EXTEOF

    # 6. Sign the server certificate with the CA
    openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
      -CAcreateserial -out cert.pem -days 3650 \
      -extfile server.ext

### Install `ca.crt` on your devices

To remove browser warnings, install `certs/ca.crt` as a trusted CA:

- **Android:** Settings → Security → Install certificate → CA certificate

- **iOS:** Settings → General → VPN & Device Management

- **Linux:** `/usr/local/share/ca-certificates/` + `update-ca-certificates`

- **macOS:** Keychain Access → System → drag the `.crt` file

### For `git clone` over HTTPS

git verifies certificates strictly. Either install the CA (as above) or use:

    GIT_SSL_NO_VERIFY=true git clone https://192.168.1.104:8080/user/repo

The `gc` CLI handles self-signed certificates automatically.

---

## CLI Reference

The CLI is called `gc` and lives in `cli/`.

| Command | Description |
|---------|-------------|
| `gc login` | Log in to a GitCode server |
| `gc logout` | Clear the local session |
| `gc whoami` | Print the current user |
| `gc create <name>` | Create a repository |
| `gc list` | List your repositories |
| `gc clone <user>/<repo>` | Clone a repository |
| `gc push` | Push the current directory to the server |
| `gc fork <user>/<repo>` | Fork a repository |
| `gc token new <name>` | Create an API token |
| `gc token list` | List API tokens |
| `gc token delete <id>` | Delete an API token |
| `gc config` | Show or set configuration |

### Examples

    # Login
    gc login
    # Server URL: https://192.168.1.104:8080
    # Username: alice
    # Password: ********

    # Create a repository
    gc create my-project -d "My first project"

    # Clone a repository
    gc clone alice/my-project

    # Push an existing directory
    cd ~/my-project
    git init -b main
    git add .
    git commit -m "Initial commit"
    git remote add origin https://192.168.1.104:8080/alice/my-project
    gc push

    # Fork a repository
    gc fork bob/cool-project

    # Manage tokens
    gc token new "ci-token"
    gc token list

---

## Project Layout

    Gitcode/
    ├── backend/                  Python HTTP API
    │   ├── server.py             Routing and HTTP handlers
    │   ├── db.py                 SQLite schema and queries
    │   ├── auth.py               Password hashing, sessions
    │   ├── totp.py               RFC 6238 TOTP implementation
    │   ├── git_ops.py            git CLI wrapper (subprocess)
    │   ├── config.py             CONFIG file loader
    │   └── README.md             Backend notes
    ├── frontend/                 React + Vite + Tailwind
    │   ├── index.html
    │   ├── package.json
    │   ├── vite.config.js
    │   ├── tailwind.config.js
    │   └── src/
    │       ├── App.jsx           Routes
    │       ├── main.jsx          Entry point
    │       ├── index.css         Tailwind + globals
    │       ├── pages/            Route components
    │       ├── components/       Reusable UI
    │       ├── contexts/         Auth, Settings
    │       ├── hooks/            Custom hooks
    │       └── lib/              api, i18n, helpers
    ├── cli/                      Python CLI package
    │   ├── pyproject.toml
    │   └── src/gitcode_cli/
    │       ├── __init__.py
    │       └── __main__.py
    ├── certs/                    Local CA and server certs (gitignored)
    ├── data/                     SQLite DB, avatars, release assets
    ├── repos/                    Bare git repositories
    ├── docs/                     Design notes
    ├── CONFIG                    Runtime configuration
    ├── README.md                 This file
    ├── CHANGELOG.md              Version history
    ├── CONTRIBUTING.md           How to contribute
    └── LICENSE                   MIT

---

## Architecture

    Browser (React + Tailwind)
        |
        | HTTPS
        v
    Vite dev server (proxy)
        |
        | HTTPS
        v
    Python HTTP server (backend/server.py)
        |
        +--> auth.py       sessions, pbkdf2
        +--> totp.py       RFC 6238 TOTP
        +--> db.py         SQLite queries
        +--> git_ops.py    subprocess git
        +--> config.py     CONFIG loader
        |
        v
    data/gitcode.db   +   repos/<user>/<repo>.git/   +   data/releases/

### Why stdlib only

- Runs anywhere Python runs — no compilation, no wheels

- No version conflicts, no dependency hell

- Easy to audit, easy to read

### Git operations

All git commands are run via `subprocess`. The `git_ops.py` module wraps
`git init`, `git show`, `git log`, `git ls-tree`, `git clone --bare`,
`git bundle`, and `git fetch` from a bundle.

### Authentication

Two mechanisms:

1. **Session cookies** (`gc_session`) — for the web UI
2. **API tokens** (`gc_...`) — for the CLI and programmatic access

Both are handled by `current_user()` in `server.py`.

### Visibility

Posts support three visibility levels: `public`, `followers`, and `private`.
Repositories support two: public and private. Filters are applied at query
time in `db.py`.

---

## API Overview

The backend exposes a JSON API under `/api/`. Highlights:

### Auth

    POST   /api/auth/signup
    POST   /api/auth/login
    POST   /api/auth/logout
    GET    /api/auth/me
    POST   /api/users/me/password
    POST   /api/users/me/avatar
    POST   /api/users/me/username

### Users

    GET    /api/users/<username>
    GET    /api/users/<username>/followers
    GET    /api/users/<username>/following
    POST   /api/users/<username>/follow
    DELETE /api/users/<username>/follow

### Repositories

    GET    /api/repos
    GET    /api/repos/mine
    POST   /api/repos
    GET    /api/repos/<owner>/<name>
    PATCH  /api/repos/<owner>/<name>
    DELETE /api/repos/<owner>/<name>
    POST   /api/repos/<owner>/<name>/fork

### Repository content

    GET    /api/repos/<owner>/<name>/tree
    GET    /api/repos/<owner>/<name>/blob
    GET    /api/repos/<owner>/<name>/raw
    GET    /api/repos/<owner>/<name>/commits
    GET    /api/repos/<owner>/<name>/diff
    GET    /api/repos/<owner>/<name>/branches
    GET    /api/repos/<owner>/<name>/contributors

### Social

    GET    /api/repos/<owner>/<name>/social
    POST   /api/repos/<owner>/<name>/star
    POST   /api/repos/<owner>/<name>/watch

### Issues

    GET    /api/repos/<owner>/<name>/issues
    POST   /api/repos/<owner>/<name>/issues
    GET    /api/repos/<owner>/<name>/issues/<number>
    PATCH  /api/repos/<owner>/<name>/issues/<number>
    POST   /api/repos/<owner>/<name>/issues/<number>/comments

### Posts

    GET    /api/posts
    POST   /api/posts
    GET    /api/posts/<slug>
    PATCH  /api/posts/<slug>
    DELETE /api/posts/<slug>
    POST   /api/posts/<slug>/like
    POST   /api/posts/<slug>/bookmark
    GET    /api/posts/<slug>/comments
    POST   /api/posts/<slug>/comments

### Notifications

    GET    /api/notifications
    GET    /api/notifications/count
    POST   /api/notifications/read
    POST   /api/notifications/clear
    DELETE /api/notifications/<id>

### Settings

    GET    /api/settings
    POST   /api/settings

### Two-factor authentication

    GET    /api/2fa/status
    POST   /api/2fa/setup
    POST   /api/2fa/verify
    POST   /api/2fa/disable
    POST   /api/2fa/verify-login

### API tokens

    GET    /api/tokens
    POST   /api/tokens
    DELETE /api/tokens/<id>

### Search

    GET    /api/search?q=<query>&type=all|users|repos|code

Full request/response shapes are visible in `backend/server.py`.

---

## Roadmap

### Done

- [x] User accounts (signup, login, sessions)

- [x] API tokens with scopes and expiration

- [x] Two-factor authentication (TOTP + backup codes)

- [x] Repositories (create, delete, settings)

- [x] Branches (create, delete, set default)

- [x] Commits and diffs

- [x] Forks and contributors

- [x] Releases with asset uploads

- [x] Issues with comments

- [x] Posts (short-form + articles)

- [x] Post likes, bookmarks, comments

- [x] Comment likes, bookmarks, deletion

- [x] Follows (followers / following)

- [x] Stars and watches

- [x] Activity feed

- [x] In-app notifications with unread badge

- [x] Search (users, repos, code)

- [x] Settings panel with i18n and RTL

- [x] Compact mode

- [x] Line numbers in the code viewer

- [x] HTTPS with a self-signed CA

- [x] CLI (`gc`)

### Planned

- [ ] Pull requests

- [ ] Webhooks

- [ ] Email notifications

- [ ] Git LFS

- [ ] SSH access

- [ ] Organizations and teams

- [ ] CI / Actions

- [ ] PWA support

- [ ] Pagination for long lists

- [ ] Markdown editor with live preview

---

## Development

### Backend

    cd backend
    python server.py

- Database: `data/gitcode.db` (SQLite)

- Schema is created automatically on first run

- Sessions stored in the `sessions` table

- Config read from the root `CONFIG` file

### Frontend

    cd frontend
    npm run dev

- Vite dev server proxies `/api/*` to the backend

- Hot module reload enabled

- Tailwind for styling, no other UI libraries

### CLI

    cd cli
    pip install -e .
    gc --help

### Tests

There is no formal test suite yet. Smoke tests are done manually against a
fresh database.

---

## Contributing

See `CONTRIBUTING.md` for guidelines.

Short version:

- No external UI libraries beyond React and Tailwind.

- No external backend frameworks beyond Python stdlib and `markdown`.

- Keep the CLI self-contained (stdlib only).

- Every feature must work on Linux, macOS, and Android (via Termux).

- Comments in English, short and clear. No emoji in code.

---

## License

MIT. See `LICENSE` for the full text.

Third-party content (Wikipedia pages in the archive) follows its original
license: CC BY-SA 4.0.

---

## Acknowledgments

GitCode is inspired by:

- **GitHub** — for the overall product vision

- **Gitea** and **Forgejo** — for proving that lightweight self-hosted Git
  platforms can be excellent

- **Primer** — for the design language the UI borrows from

Built as a learning project to demonstrate that a complete Git hosting
platform can run on modest hardware with zero external dependencies.
