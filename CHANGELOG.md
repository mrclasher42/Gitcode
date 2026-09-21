# Changelog

All notable changes to GitCode will be documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Compact mode in Settings
- Show line numbers in the file viewer
- In-app confirmation dialogs (replacing native browser modals)
- Notifications delete (single + clear all)
- 2FA disable form with inline password input

### Fixed
- Session TTL now correctly 30 days after 2FA verification
- Slug normalization (lowercase) for all posts
- Notification links now point to the correct target
- Star / watch / fork counters now include demo extras
- TOTP QR generation no longer runs twice

## [0.1.0] - 2026-09-20

### Added
- User signup, login, logout, sessions
- API tokens with scopes and expiration
- Two-factor authentication (TOTP + backup codes)
- Repository creation, deletion, and settings
- Branch management (create, delete, set default)
- Commit history and diffs
- Forks and contributor lists
- Releases with asset uploads
- Issues with comments and state
- Posts (short-form and long-form articles)
- Post likes, bookmarks, and comments
- Comment likes, bookmarks, and deletion
- Follows (followers / following)
- Stars and watches
- Activity feed
- In-app notifications with unread badge
- Search across users, repos, and code
- Settings panel (theme, language, privacy, notifications)
- Full RTL support for Arabic
- HTTPS with a self-signed local CA
- CLI (`gc`) for login, clone, push, create, fork, tokens
- Markdown rendering for README, posts, and issues
- Responsive layout with light and dark themes
