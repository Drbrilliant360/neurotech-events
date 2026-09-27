"""add offline check-in idempotency records

Revision ID: e7a4b9c1d2f3
Revises: d6f3a9b8c2e1
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e7a4b9c1d2f3"
down_revision: str | Sequence[str] | None = "d6f3a9b8c2e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "offline_check_in_operations",
        sa.Column("client_operation_id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("operator_user_id", sa.Uuid(), nullable=True),
        sa.Column("manifest_id", sa.Uuid(), nullable=False),
        sa.Column("device_id_hash", sa.String(64), nullable=True),
        sa.Column("outcome", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["operator_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_operation_id", name="uq_offline_check_in_operations_client_operation_id"),
    )
    op.create_index("ix_offline_check_in_operations_event_id", "offline_check_in_operations", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_offline_check_in_operations_event_id", table_name="offline_check_in_operations")
    op.drop_table("offline_check_in_operations")
