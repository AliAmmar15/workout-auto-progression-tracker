from datetime import datetime
from typing import Optional

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    muscle_group: Mapped[str] = mapped_column(String(50), nullable=False)
    equipment: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="none"
    )
    # Canonical metadata (nullable so custom/unknown exercises still work)
    exercise_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    rep_range_min: Mapped[Optional[int]] = mapped_column(nullable=True)
    rep_range_max: Mapped[Optional[int]] = mapped_column(nullable=True)
    progression_rate: Mapped[Optional[float]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    workout_sets: Mapped[list["WorkoutSet"]] = relationship(back_populates="exercise")


# Avoid circular import
from app.models.workout_set import WorkoutSet  # noqa: E402, F401
