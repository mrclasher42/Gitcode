# Database schema

SQLite database at `data/gitcode.db`.

## users

    id            INTEGER PRIMARY KEY
    username      TEXT UNIQUE NOT NULL
    email         TEXT UNIQUE NOT NULL
    password_hash TEXT NOT NULL
    salt          TEXT NOT NULL
    created_at    INTEGER NOT NULL
    bio           TEXT DEFAULT ''
    location      TEXT DEFAULT ''
    website       TEXT DEFAULT ''

## sessions

    token       TEXT PRIMARY KEY
    user_id     INTEGER NOT NULL
    created_at  INTEGER NOT NULL
    expires_at  INTEGER NOT NULL
    user_agent  TEXT DEFAULT ''

## repos

    id             INTEGER PRIMARY KEY
    owner_id       INTEGER NOT NULL
    name           TEXT NOT NULL
    description    TEXT DEFAULT ''
    is_private     INTEGER DEFAULT 0
    default_branch TEXT DEFAULT 'main'
    created_at     INTEGER NOT NULL
    updated_at     INTEGER NOT NULL
    UNIQUE(owner_id, name)

## stars

    user_id    INTEGER NOT NULL
    repo_id    INTEGER NOT NULL
    created_at INTEGER NOT NULL
    PRIMARY KEY (user_id, repo_id)

## issues

    id         INTEGER PRIMARY KEY
    repo_id    INTEGER NOT NULL
    author_id  INTEGER NOT NULL
    number     INTEGER NOT NULL
    title      TEXT NOT NULL
    body       TEXT DEFAULT ''
    state      TEXT DEFAULT 'open'
    created_at INTEGER NOT NULL
    updated_at INTEGER NOT NULL
    UNIQUE(repo_id, number)

## issue_comments

    id         INTEGER PRIMARY KEY
    issue_id   INTEGER NOT NULL
    author_id  INTEGER NOT NULL
    body       TEXT NOT NULL
    created_at INTEGER NOT NULL

## watches

    user_id    INTEGER NOT NULL
    repo_id    INTEGER NOT NULL
    created_at INTEGER NOT NULL
    PRIMARY KEY (user_id, repo_id)
