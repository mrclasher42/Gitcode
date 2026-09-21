# Contributing to GitCode

Thanks for your interest. GitCode is a learning project — contributions that
improve clarity and correctness are welcome.

## Ground rules

- No external UI frameworks in the frontend beyond React and Tailwind.
- No external frameworks in the backend beyond Python stdlib and `markdown`.
- Keep the CLI self-contained (Python stdlib only).
- Every feature must work on Linux, macOS, and Android (via Termux).

## Setup

    git clone https://github.com/mrclasher42/Gitcode.git
    cd Gitcode

    # Backend
    cd backend
    python server.py

    # Frontend (in another terminal)
    cd frontend
    npm install
    npm run dev

    # CLI
    cd cli
    pip install -e .

## Code style

- Python: PEP 8, 4-space indent.
- JavaScript / JSX: 2-space indent.
- Comments in English, short and clear.
- No emoji in code. Emoji only in documentation when needed.

## Reporting bugs

Please include:

- OS and version
- Python version (`python --version`)
- Node version (`node --version`)
- Reproduction steps

## Pull requests

- One feature or fix per PR.
- Update `CHANGELOG.md`.
- Run a quick smoke test locally.
