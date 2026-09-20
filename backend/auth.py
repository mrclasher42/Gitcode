"""Password hashing and session tokens."""
import os
import hmac
import hashlib
import secrets

ITERATIONS = 200_000
SESSION_TTL = 60 * 60 * 24 * 30  # 30 days


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        ITERATIONS,
    )
    return dk.hex(), salt


def verify_password(password, stored_hash, salt):
    candidate, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate, stored_hash)


def new_session_token():
    return secrets.token_urlsafe(32)
