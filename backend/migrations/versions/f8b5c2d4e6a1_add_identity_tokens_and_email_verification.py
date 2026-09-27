"""add identity tokens and email verification

Revision ID: f8b5c2d4e6a1
Revises: e7a4b9c1d2f3
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f8b5c2d4e6a1"
down_revision: str | Sequence[str] | None = "e7a4b9c1d2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "identity_tokens",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.String(length=24), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_identity_tokens_user_purpose", "identity_tokens", ["user_id", "purpose"])


def downgrade() -> None:
    op.drop_index("ix_identity_tokens_user_purpose", table_name="identity_tokens")
    op.drop_table("identity_tokens")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("email_verified_at")
