"""Run the real Alembic chain against a throwaway SQLite file.

Alembic runs in a subprocess with an explicit DATABASE_URL so it can never pick up the
developer's `.env` (which may point at a shared or production database).
"""

import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.models import User

BACKEND = Path(__file__).resolve().parents[1]


def _alembic(database_url: str, *args: str) -> subprocess.CompletedProcess:
    env = {**os.environ, "DATABASE_URL": database_url}
    return subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", *args],
        cwd=BACKEND, env=env, capture_output=True, text=True, timeout=120,
    )


def test_migrations_upgrade_match_models_and_accept_inserts(tmp_path) -> None:
    url = f"sqlite:///{tmp_path / 'migrations.db'}"
    upgrade = _alembic(url, "upgrade", "head")
    assert upgrade.returncode == 0, upgrade.stderr
    check = _alembic(url, "check")
    assert check.returncode == 0, check.stdout + check.stderr

    # Server-side timestamp defaults must work on SQLite, not only PostgreSQL.
    engine = create_engine(url)
    with Session(engine) as session:
        session.add(User(email="migrated@example.org", full_name="Migrated User"))
        session.commit()
    engine.dispose()

    downgrade = _alembic(url, "downgrade", "base")
    assert downgrade.returncode == 0, downgrade.stderr
