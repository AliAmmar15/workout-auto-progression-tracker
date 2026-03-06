from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate, ExerciseResponse
from app.services import exercise_service

router = APIRouter()


@router.get("", response_model=list[ExerciseResponse])
def list_exercises(
    muscle_group: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all exercises, optionally filtered by muscle_group."""
    return exercise_service.get_all_exercises(db, muscle_group)


@router.get("/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(exercise_id: int, db: Session = Depends(get_db)):
    """Get a single exercise by ID."""
    return exercise_service.get_exercise_by_id(db, exercise_id)


@router.post("", status_code=201, response_model=ExerciseResponse)
def create_exercise(data: ExerciseCreate, db: Session = Depends(get_db)):
    """Create a new exercise."""
    return exercise_service.create_exercise(db, data)


@router.put("/{exercise_id}", response_model=ExerciseResponse)
def update_exercise(
    exercise_id: int, data: ExerciseUpdate, db: Session = Depends(get_db)
):
    """Update an existing exercise."""
    return exercise_service.update_exercise(db, exercise_id, data)


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    """Delete an exercise."""
    exercise_service.delete_exercise(db, exercise_id)
