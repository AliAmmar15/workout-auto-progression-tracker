from datetime import datetime

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
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    workout_sets: Mapped[list["WorkoutSet"]] = relationship(back_populates="exercise")


# Avoid circular import
from app.models.workout_set import WorkoutSet  # noqa: E402, F401
