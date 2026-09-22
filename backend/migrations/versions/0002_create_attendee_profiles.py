"""create attendee profiles

Revision ID: 0002_create_attendee_profiles
Revises: 0001_create_users
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_create_attendee_profiles"
down_revision = "0001_create_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendee_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("organization", sa.String(length=160), nullable=True),
        sa.Column("job_title", sa.String(length=160), nullable=True),
        sa.Column("country", sa.String(length=80), nullable=True),
        sa.Column("interests", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_attendee_profiles_user_id", "attendee_profiles", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_attendee_profiles_user_id", table_name="attendee_profiles")
    op.drop_table("attendee_profiles")
