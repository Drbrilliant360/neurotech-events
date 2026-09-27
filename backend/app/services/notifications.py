"""In-app notifications. Kept free of other service imports so any service can notify."""

import uuid

from sqlalchemy.orm import Session

from app.db.models import Notification
from app.db.models.enums import NotificationCategory


def notify(
    db: Session, attendee_id: uuid.UUID, category: NotificationCategory, title: str, body: str | None = None
) -> None:
    """Stage an in-app notification in the caller's transaction."""
    db.add(Notification(attendee_id=attendee_id, category=category, title=title[:200], body=body, is_read=False))
