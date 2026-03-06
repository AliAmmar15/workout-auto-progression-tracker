from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import DATABASE_URL


# SQLAlchemy engine — swap postgresql:// to postgresql+psycopg:// for psycopg v3
engine = create_engine(
    DATABASE_URL.replace("postgresql://", "postgresql+psycopg://"),
    pool_pre_ping=True,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Declarative base for all models
class Base(DeclarativeBase):
    pass
