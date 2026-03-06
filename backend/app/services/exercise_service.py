from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.exercise import Exercise
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate


def get_all_exercises(
    db: Session, muscle_group: Optional[str] = None
) -> list[Exercise]:
    """Return all exercises, optionally filtered by muscle group."""
    query = db.query(Exercise)
    if muscle_group:
        query = query.filter(Exercise.muscle_group == muscle_group)
    return query.order_by(Exercise.name).all()


def get_exercise_by_id(db: Session, exercise_id: int) -> Exercise:
    """Return a single exercise or raise 404."""
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


def create_exercise(db: Session, data: ExerciseCreate) -> Exercise:
    """Create a new exercise. Raises 409 if name already exists."""
    existing = db.query(Exercise).filter(Exercise.name == data.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Exercise name already exists")

    exercise = Exercise(
        name=data.name,
        muscle_group=data.muscle_group,
        equipment=data.equipment or "none",
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


def update_exercise(
    db: Session, exercise_id: int, data: ExerciseUpdate
) -> Exercise:
    """Update an existing exercise. Raises 404 if not found, 409 on duplicate name."""
    exercise = get_exercise_by_id(db, exercise_id)

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        existing = (
            db.query(Exercise)
            .filter(Exercise.name == update_data["name"], Exercise.id != exercise_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Exercise name already exists")

    for field, value in update_data.items():
        setattr(exercise, field, value)

    db.commit()
    db.refresh(exercise)
    return exercise


def delete_exercise(db: Session, exercise_id: int) -> None:
    """Delete an exercise. Raises 404 if not found."""
    exercise = get_exercise_by_id(db, exercise_id)
    db.delete(exercise)
    db.commit()
