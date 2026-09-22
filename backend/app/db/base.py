from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for persistence models added by later phases."""
