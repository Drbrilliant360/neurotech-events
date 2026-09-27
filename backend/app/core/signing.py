"""Signed, offline-verifiable ticket QR payloads.

Payload format: `NTQ1.<registration uuid hex>.<signature>`. The signature is an HMAC over the
registration id with a key derived from the dedicated ticket signing key, so a QR code cannot
be forged or altered, and codes can be revoked by cancelling the registration.
"""

import base64
import hashlib
import hmac
import json
import uuid
from typing import Any

PREFIX = "NTQ1"
_CONTEXT = b"neurotech-events/check-in/v1"
_MANIFEST_CONTEXT = b"neurotech-events/offline-manifest/v1"


def _key(secret: str) -> bytes:
    # Domain-separated so a check-in signature can never double as a JWT signature.
    return hmac.new(secret.encode(), _CONTEXT, hashlib.sha256).digest()


def _signature(secret: str, registration_id: uuid.UUID) -> str:
    digest = hmac.new(_key(secret), registration_id.bytes, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest[:18]).decode().rstrip("=")


def sign_ticket(secret: str, registration_id: uuid.UUID) -> str:
    return f"{PREFIX}.{registration_id.hex}.{_signature(secret, registration_id)}"


def verify_ticket(secret: str, payload: str) -> uuid.UUID | None:
    """The registration id for a genuine payload, otherwise None."""
    parts = payload.strip().split(".")
    if len(parts) != 3 or parts[0] != PREFIX:
        return None
    try:
        registration_id = uuid.UUID(hex=parts[1])
    except ValueError:
        return None
    if not hmac.compare_digest(parts[2], _signature(secret, registration_id)):
        return None
    return registration_id


def sign_offline_manifest(secret: str, claims: dict[str, Any]) -> str:
    """Return a compact integrity-protected manifest. The server remains authoritative."""
    raw = json.dumps(claims, separators=(",", ":"), sort_keys=True).encode()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    key = hmac.new(secret.encode(), _MANIFEST_CONTEXT, hashlib.sha256).digest()
    signature = base64.urlsafe_b64encode(hmac.new(key, body.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return f"NTM1.{body}.{signature}"


def verify_offline_manifest(secret: str, token: str) -> dict[str, Any] | None:
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != "NTM1":
        return None
    key = hmac.new(secret.encode(), _MANIFEST_CONTEXT, hashlib.sha256).digest()
    expected = base64.urlsafe_b64encode(hmac.new(key, parts[1].encode(), hashlib.sha256).digest()).decode().rstrip("=")
    if not hmac.compare_digest(parts[2], expected):
        return None
    try:
        claims = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
    return claims if isinstance(claims, dict) else None
