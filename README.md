# GitCode

A lightweight, self-hosted Git platform built from scratch in Python and React.

GitCode runs on Termux / Android without root. It stores real git repositories on
disk and serves them through a small HTTP API and a modern web interface.

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
- Termux (Android), Linux, or macOS

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

Edit `CONFIG` in the repository root to control runtime behavior:

    # Repository features
    allow_forks = true
    allow_delete = true
    allow_private = true
    allow_web_editor = true
    allow_signup = true

    # Limits
    max_repos_per_user = 50
    max_file_size_kb = 5120

    # Defaults
    default_branch = main
    default_readme = README.gc

    # Session
    session_ttl_days = 30

    # UI
    site_name = GitCode
    items_per_page = 30

Values are read on server startup.

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

Built as a learning project to demonstrate that a complete Git hosting platform
can run on a phone. Inspired by GitHub, Gitea, and Forgejo.
