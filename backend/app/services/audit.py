import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import AuditLog, User


def record(
    db: Session,
    action: str,
    *,
    actor: User | None = None,
    target_type: str | None = None,
    target_id: uuid.UUID | str | None = None,
    event_id: uuid.UUID | None = None,
    ip_address: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Stage an audit entry in the caller's transaction; it commits (or rolls back) with it.

    Never pass secrets, tokens or payment credentials in `details`.
    """
    db.add(
        AuditLog(
            actor_user_id=actor.id if actor is not None else None,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            event_id=event_id,
            ip_address=ip_address,
            details=details or {},
        )
    )
