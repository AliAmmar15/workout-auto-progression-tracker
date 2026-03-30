from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_optional_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.exercise import (
    CustomExerciseCreate,
    ExerciseCreate,
    ExerciseUpdate,
    ExerciseResponse,
)
from app.services import exercise_service

router = APIRouter()


@router.get("/lookup", response_model=ExerciseResponse)
def lookup_exercise_by_name(
    name: str = Query(..., min_length=1, description="Exercise name or alias"),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Look up an exercise by name or alias, resolving to the canonical record."""
    return exercise_service.get_exercise_by_name(
        db,
        name,
        user_id=current_user.id if current_user else None,
    )


@router.get("", response_model=list[ExerciseResponse])
def list_exercises(
    muscle_group: Optional[str] = None,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """List all exercises, optionally filtered by muscle_group."""
    return exercise_service.get_all_exercises(
        db,
        muscle_group,
        user_id=current_user.id if current_user else None,
    )


@router.post("/custom", status_code=201, response_model=ExerciseResponse)
def create_custom_exercise(
    data: CustomExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a user-owned custom exercise."""
    return exercise_service.create_custom_exercise(db, current_user.id, data)


@router.get("/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(
    exercise_id: str,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Get a single exercise by ID."""
    return exercise_service.get_exercise_by_id(
        db,
        exercise_id,
        user_id=current_user.id if current_user else None,
    )


@router.post("", status_code=201, response_model=ExerciseResponse)
def create_exercise(
    data: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new exercise. Requires authentication."""
    return exercise_service.create_exercise(db, data)


@router.put("/{exercise_id}", response_model=ExerciseResponse)
def update_exercise(
    exercise_id: str,
    data: ExerciseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing exercise. Requires authentication."""
    return exercise_service.update_exercise(db, exercise_id, data)


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(
    exercise_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an exercise. Requires authentication."""
    exercise_service.delete_exercise(db, exercise_id)

