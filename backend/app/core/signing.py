"""Signed, offline-verifiable ticket QR payloads.

Payload format: `NTQ1.<registration uuid hex>.<signature>`. The signature is an HMAC over the
registration id with a key derived from the JWT secret, so a QR code cannot be forged or
altered, and codes can be revoked by cancelling the registration.
"""

import base64
import hashlib
import hmac
import uuid

PREFIX = "NTQ1"
_CONTEXT = b"neurotech-events/check-in/v1"


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
