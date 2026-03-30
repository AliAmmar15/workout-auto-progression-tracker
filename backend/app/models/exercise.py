from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.database.session import Base


class Exercise(Base):
    __tablename__ = "exercises"
    __table_args__ = (
        UniqueConstraint("canonical_name", "user_id", name="uq_exercises_canonical_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    canonical_name: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True, default=lambda: f"custom_{uuid4().hex}"
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    muscle_group: Mapped[str] = mapped_column(String(50), nullable=False)
    equipment: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="none"
    )
    is_custom: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Canonical metadata (nullable so custom/unknown exercises still work)
    exercise_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    rep_range_min: Mapped[Optional[int]] = mapped_column(nullable=True)
    rep_range_max: Mapped[Optional[int]] = mapped_column(nullable=True)
    progression_rate: Mapped[Optional[float]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    # Backward-compatible alias for older service logic/tests.
    name = synonym("display_name")

    # Relationships
    workout_sets: Mapped[list["WorkoutSet"]] = relationship(back_populates="exercise")
    owner: Mapped[Optional["User"]] = relationship(back_populates="custom_exercises")


# Avoid circular import
from app.models.workout_set import WorkoutSet  # noqa: E402, F401
from app.models.user import User  # noqa: E402, F401
