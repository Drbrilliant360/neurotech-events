"""add indexes for seat counting, webhook lookups and check-in counts

Revision ID: c5a2f8e7d1b4
Revises: b7e1c4d2a9f3
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c5a2f8e7d1b4"
down_revision: str | Sequence[str] | None = "b7e1c4d2a9f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_registrations_ticket_status_created", "registrations", ["ticket_type_id", "status", "created_at"]
    )
    op.create_index("ix_payments_provider_reference", "payments", ["provider_reference"])
    op.create_index("ix_check_ins_event_undone", "check_ins", ["event_id", "undone"])


def downgrade() -> None:
    op.drop_index("ix_check_ins_event_undone", table_name="check_ins")
    op.drop_index("ix_payments_provider_reference", table_name="payments")
    op.drop_index("ix_registrations_ticket_status_created", table_name="registrations")
