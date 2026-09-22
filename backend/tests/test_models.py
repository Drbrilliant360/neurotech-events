from sqlalchemy import create_engine, inspect

import app.db.models  # noqa: F401
from app.db.base import Base

EXPECTED_TABLES = {
    "organizations",
    "users",
    "attendees",
    "venues",
    "events",
    "speakers",
    "sessions",
    "timeline_milestones",
    "ticket_types",
    "registrations",
    "payments",
    "payment_events",
    "check_ins",
    "certificates",
    "notifications",
    "communications",
    "networking_profiles",
    "connections",
    "saved_sessions",
    "sponsors",
    "sponsor_events",
}


def test_metadata_matches_expected_tables() -> None:
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_schema_creates_on_sqlite() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    assert set(inspect(engine).get_table_names()) == EXPECTED_TABLES


def test_every_table_has_a_primary_key() -> None:
    for table in Base.metadata.sorted_tables:
        assert list(table.primary_key.columns), f"{table.name} has no primary key"


def test_every_foreign_key_targets_a_known_table() -> None:
    for table in Base.metadata.sorted_tables:
        for fk in table.foreign_keys:
            assert fk.column.table.name in EXPECTED_TABLES, f"{table.name}.{fk.parent.name}"
