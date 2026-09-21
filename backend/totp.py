"""TOTP (RFC 6238) — compatible with Google Authenticator, Authy, etc.

Uses only Python stdlib.
"""
import hmac
import hashlib
import base64
import struct
import time
import secrets


def generate_secret(length=20):
    """Generate a random base32 secret (default 160 bits)."""
    raw = secrets.token_bytes(length)
    return base64.b32encode(raw).decode("utf-8").rstrip("=")


def _hotp(secret, counter, digits=6):
    """HMAC-based OTP (RFC 4226)."""
    # Pad secret to multiple of 8
    padding = "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(secret + padding, casefold=True)
    msg = struct.pack(">Q", counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = (
        ((h[offset] & 0x7F) << 24)
        | ((h[offset + 1] & 0xFF) << 16)
        | ((h[offset + 2] & 0xFF) << 8)
        | (h[offset + 3] & 0xFF)
    ) % (10 ** digits)
    return str(code).zfill(digits)


def totp(secret, for_time=None, step=30, digits=6):
    """Generate TOTP code for a given time."""
    if for_time is None:
        for_time = time.time()
    counter = int(for_time // step)
    return _hotp(secret, counter, digits)


def verify_totp(secret, code, window=1, step=30, digits=6):
    """Verify a TOTP code allowing ±window steps (default ±30s)."""
    code = str(code).strip().replace(" ", "")
    if not code.isdigit() or len(code) != digits:
        return False
    now = time.time()
    for offset in range(-window, window + 1):
        if totp(secret, now + offset * step, step, digits) == code:
            return True
    return False


def provisioning_uri(secret, username, issuer="GitCode"):
    """Build otpauth:// URI for QR code."""
    from urllib.parse import quote
    label = quote("%s:%s" % (issuer, username))
    params = "secret=%s&issuer=%s" % (secret, quote(issuer))
    return "otpauth://totp/%s?%s" % (label, params)


def generate_backup_codes(n=8):
    """Generate N backup codes (10 chars each)."""
    codes = []
    for _ in range(n):
        codes.append("-".join(secrets.token_hex(2).upper() for _ in range(2)))
    return codes
