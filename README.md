# GitCode

A lightweight, self-hosted Git platform built from scratch in Python and React.

GitCode stores real git repositories on disk and serves them through a small HTTP API and a modern web interface.

![Status](https://img.shields.io/badge/status-beta-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)

---

## Features

### Git hosting
- Create, delete, and configure repositories (public / private)
- Fork repositories from other users
- Branch management (create, delete, set default)
- Commit history and diffs
- Releases with binary asset uploads
- Contributors list

### Social
- Posts (short-form and long-form articles)
- Post likes, bookmarks, and comments
- Comment likes, bookmarks, and deletion
- Follow users (followers / following)
- Star and watch repositories
- Activity feed
- In-app notifications with unread badge
- Live counters (formatted as 1.2K, 1.4M, etc.)

### Issues
- Open, comment on, and close issues
- Per-issue numbering
- Comment engagement (likes, bookmarks)

### User accounts
- Sign up, login, logout
- Cookie-based sessions (30-day TTL)
- API tokens with scopes and expiration
- Two-factor authentication (TOTP / Google Authenticator)
- Backup codes
- Profile customization (avatar upload with crop, bio, location, website)
- Change username

### Settings panel
- Theme (light / dark / system)
- Language (English / Arabic with full RTL support)
- Notification preferences
- Privacy controls
- Compact mode
- Show line numbers
- Two-factor authentication
- API token management

### Search
- Users, repositories, and code
- Per-repository file search

### Web interface
- Responsive design (mobile and desktop)
- Dark and light themes
- RTL support for Arabic
- Markdown rendering (README, posts, issues)
- Syntax-aware file viewer with line numbers
- In-app modals and confirmation dialogs

### HTTP server
- HTTPS with self-signed CA
- Auto-generated certificates
- Cookie and Bearer token authentication
- CORS-friendly API

### CLI (`gc`)
- `gc login` / `gc logout` / `gc whoami`
- `gc create` / `gc list` / `gc clone` / `gc push`
- `gc fork` / `gc token`
- Works over HTTPS with self-signed certificates

---

## Requirements

- **Python** 3.8 or newer
- **Node.js** 18 or newer (for the web UI)
- **git** CLI in PATH
- Linux, macOS, or Android (via Termux)

---

## Installation

### 1. Clone the repository

    git clone https://github.com/mrclasher42/Gitcode.git
    cd Gitcode

### 2. Run the backend

    cd backend
    python server.py
    # API listens on https://localhost:8080

### 3. Run the frontend

    cd frontend
    npm install
    npm run dev
    # Web UI on https://localhost:5175

### 4. Install the CLI

    cd cli
    pip install -e .

    gc login
    # Server URL: https://192.168.1.104:8080
    # Username: your-username
    # Password: your-password

---

## HTTPS setup

GitCode uses a self-signed CA for HTTPS. Certificates live in `certs/` and are
**not** committed to the repository (see `.gitignore`).

To generate a local CA and server certificate, run:

    mkdir -p certs
    cd certs

    openssl genrsa -out ca.key 2048
    openssl req -new -x509 -key ca.key -out ca.crt -days 3650 \
      -subj "/C=US/O=GitCode Local CA/CN=GitCode Local CA"

    openssl genrsa -out key.pem 2048
    openssl req -new -key key.pem -out server.csr \
      -subj "/C=US/O=GitCode/CN=localhost"

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

    openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
      -CAcreateserial -out cert.pem -days 3650 \
      -extfile server.ext

Install `ca.crt` on your devices to remove browser warnings.

---

## CLI reference

| Command | Description |
|---------|-------------|
| `gc login` | Log in to a GitCode server |
| `gc logout` | Clear the local session |
| `gc whoami` | Print the current user |
| `gc create <name>` | Create a repository |
| `gc list` | List your repositories |
| `gc clone <user>/<repo>` | Clone a repository |
| `gc push` | Push the current directory |
| `gc fork <user>/<repo>` | Fork a repository |
| `gc token new <name>` | Create an API token |
| `gc config` | Show configuration |

---

## Project layout

    Gitcode/
    ├── backend/              Python HTTP API
    │   ├── server.py         HTTP routing and endpoints
    │   ├── db.py             SQLite schema and queries
    │   ├── auth.py           Password hashing and sessions
    │   ├── totp.py           RFC 6238 TOTP (Google Authenticator)
    │   ├── git_ops.py        git CLI wrapper
    │   └── config.py         CONFIG file loader
    ├── frontend/             React + Vite + Tailwind
    │   └── src/
    │       ├── pages/        Route components
    │       ├── components/   Reusable UI
    │       ├── contexts/     Auth and settings
    │       ├── hooks/        Custom hooks
    │       └── lib/          API, i18n, helpers
    ├── cli/                  Python CLI (`gc`)
    ├── certs/                Local CA and server certs (gitignored)
    ├── data/                 SQLite DB, avatars, release assets
    ├── repos/                Bare git repositories
    └── CONFIG                Runtime configuration

---

## Configuration

GitCode is configured through a single file in the repository root called `CONFIG`.
It uses a simple `key = value` format with `#` for comments. No YAML, no JSON,
no external parser — just readable text.

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

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| **Repository features** | | | |
| `allow_forks` | bool | `true` | Enable the "Fork" button |
| `allow_delete` | bool | `true` | Allow deleting repositories |
| `allow_private` | bool | `true` | Allow creating private repositories |
| `allow_web_editor` | bool | `true` | Enable the in-browser file editor |
| `allow_signup` | bool | `true` | Allow new user registration |
| **Limits** | | | |
| `max_repos_per_user` | int | `50` | Maximum repositories per user |
| `max_file_size_kb` | int | `5120` | Maximum upload size in kilobytes |
| `max_description_length` | int | `500` | Maximum description length |
| `max_issues_per_repo` | int | `1000` | Maximum issues per repository |
| **Defaults** | | | |
| `default_branch` | str | `main` | Default branch for new repositories |
| `default_readme` | str | `README.gc` | Default README filename |
| **Session and security** | | | |
| `session_ttl_days` | int | `30` | Cookie session lifetime in days |
| `min_password_length` | int | `6` | Minimum password length |
| `max_username_length` | int | `39` | Maximum username length |
| **Interface** | | | |
| `site_name` | str | `GitCode` | Name shown in the header |
| `site_description` | str | `Self-hosted Git platform` | Short site description |
| `items_per_page` | int | `30` | Pagination size |
| `show_watch_button` | bool | `true` | Show the Watch button on repos |
| `show_star_button` | bool | `true` | Show the Star button on repos |
| `show_fork_button` | bool | `true` | Show the Fork button on repos |
| **Future features** | | | |
| `enable_issues` | bool | `true` | Enable the Issues module |
| `enable_pull_requests` | bool | `false` | Enable Pull Requests (planned) |
| `enable_wiki` | bool | `false` | Enable per-repo wiki (planned) |
| `enable_lfs` | bool | `false` | Enable Git LFS support (planned) |

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

- The file is loaded once at server startup by `backend/config.py`.
- Changes require a server restart.
- Missing keys fall back to their default values.
- Invalid values are ignored (with a warning in the server log).
- The file is **not** committed as a template — you create it once, it stays
  local. A minimal example lives in the docs.

### Reading CONFIG from Python

    import config

    if config.allow_forks():
        # show fork button

    days = config.get("session_ttl_days", 30)
    site = config.get("site_name", "GitCode")

### Environment overrides

You can override specific values with environment variables (useful for
containers and CI):

    GITCODE_PORT=9090 python server.py
    GITCODE_CONFIG=/etc/gitcode/CONFIG python server.py

---

## Roadmap

### Done
- [x] User accounts (signup, login, sessions)
- [x] API tokens
- [x] Two-factor authentication (TOTP + backup codes)
- [x] Repositories (create, delete, settings)
- [x] Branches (create, delete, set default)
- [x] Commits and diffs
- [x] Forks and contributors
- [x] Releases with asset uploads
- [x] Issues with comments
- [x] Posts (short + article)
- [x] Post likes, bookmarks, comments
- [x] Comment likes and deletion
- [x] Follows (followers / following)
- [x] Stars and watches
- [x] Activity feed
- [x] Notifications with unread badge
- [x] Search (users, repos, code)
- [x] Settings panel with i18n and RTL
- [x] Compact mode
- [x] Line numbers in the code viewer
- [x] HTTPS with self-signed CA
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

---

## Development

### Backend

    cd backend
    python server.py

- Database: `data/gitcode.db` (SQLite)
- Schemas created automatically on first run
- Sessions stored in `sessions` table

### Frontend

    cd frontend
    npm run dev

- Vite dev server proxies `/api/*` to the backend
- Hot module reload enabled

### CLI

    cd cli
    pip install -e .
    gc --help

---

## Contributing

See `CONTRIBUTING.md` for guidelines.

---

## License

MIT. See `LICENSE` for details.

Wikipedia and third-party content in archived pages follow their original licenses.

---

## Acknowledgments

Inspired by GitHub, Gitea, and Forgejo.
