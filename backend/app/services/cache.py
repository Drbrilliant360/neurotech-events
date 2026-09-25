"""Tiny in-process cache for the public catalogue.

The catalogue is identical for every visitor and changes only when an organiser edits the
programme, so it is cached for a short TTL and dropped immediately when a session commits a
change to any catalogue table. Each worker keeps its own copy; the TTL bounds staleness across
workers.
"""

import threading
import time
from collections.abc import Callable
from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.db.models import Event, EventSession, Organization, Registration, Speaker, TicketType, TimelineMilestone, Venue

CATALOGUE_TABLES = (Event, EventSession, Organization, Registration, Speaker, TicketType, TimelineMilestone, Venue)
TTL_SECONDS = 15.0

_lock = threading.Lock()
_value: Any = None
_expires = 0.0


def get_or_build(build: Callable[[], Any]) -> Any:
    global _value, _expires
    now = time.monotonic()
    with _lock:
        if _value is not None and now < _expires:
            return _value
    value = build()
    with _lock:
        _value, _expires = value, time.monotonic() + TTL_SECONDS
    return value


def invalidate() -> None:
    global _value
    with _lock:
        _value = None


@event.listens_for(Session, "after_flush")
def _mark_catalogue_changes(session: Session, flush_context) -> None:
    if any(isinstance(obj, CATALOGUE_TABLES) for obj in (*session.new, *session.dirty, *session.deleted)):
        session.info["catalogue_dirty"] = True


@event.listens_for(Session, "after_commit")
def _drop_catalogue_on_commit(session: Session) -> None:
    if session.info.pop("catalogue_dirty", False):
        invalidate()
