"""add provider-backed refunds

Revision ID: d6f3a9b8c2e1
Revises: c5a2f8e7d1b4
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d6f3a9b8c2e1"
down_revision: str | Sequence[str] | None = "c5a2f8e7d1b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "refunds",
        sa.Column("payment_id", sa.Uuid(), nullable=False),
        sa.Column("registration_id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("recipient_phone", sa.String(20), nullable=False),
        sa.Column("recipient_name", sa.String(200), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "completed",
                "failed",
                "reversed",
                name="refund_status",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.String(30), nullable=False),
        sa.Column("provider_reference", sa.String(120), nullable=True),
        sa.Column("failure_reason", sa.String(500), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount > 0", name=op.f("ck_refunds_amount_positive")),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["registration_id"], ["registrations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_refunds_idempotency_key"),
        sa.UniqueConstraint("payment_id", name="uq_refunds_payment_id"),
        sa.UniqueConstraint("provider_reference", name="uq_refunds_provider_reference"),
    )
    op.create_index(op.f("ix_refunds_event_id"), "refunds", ["event_id"])
    op.create_index(op.f("ix_refunds_registration_id"), "refunds", ["registration_id"])
    op.create_index(op.f("ix_refunds_status"), "refunds", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_refunds_status"), table_name="refunds")
    op.drop_index(op.f("ix_refunds_registration_id"), table_name="refunds")
    op.drop_index(op.f("ix_refunds_event_id"), table_name="refunds")
    op.drop_table("refunds")
