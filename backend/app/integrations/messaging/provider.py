import logging
from dataclasses import dataclass
from typing import Protocol

from app.config import Settings

logger = logging.getLogger(__name__)


class NotificationProvider(Protocol):
    def send_identity_link(self, *, recipient: str, kind: str, url: str) -> None: ...


class ConsoleNotificationProvider:
    """Local-only provider. Hardened settings reject it so production secrets never reach logs."""

    def send_identity_link(self, *, recipient: str, kind: str, url: str) -> None:
        logger.warning("DEV identity notification kind=%s recipient=%s url=%s", kind, recipient, url)


@dataclass(frozen=True)
class CapturedNotification:
    recipient: str
    kind: str
    url: str


class CaptureNotificationProvider:
    """In-memory test/development mailbox; never persists or logs tokens."""

    def __init__(self) -> None:
        self.messages: list[CapturedNotification] = []

    def send_identity_link(self, *, recipient: str, kind: str, url: str) -> None:
        self.messages.append(CapturedNotification(recipient, kind, url))


class DisabledNotificationProvider:
    def send_identity_link(self, *, recipient: str, kind: str, url: str) -> None:
        logger.error("Identity notification delivery is disabled (kind=%s)", kind)


def notification_provider(settings: Settings) -> NotificationProvider:
    if settings.notification_provider == "console" and not settings.is_hardened:
        return ConsoleNotificationProvider()
    return DisabledNotificationProvider()
