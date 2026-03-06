from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.workout_set import (
    WorkoutSetCreate,
    WorkoutSetUpdate,
    WorkoutSetResponse,
)
from app.services import workout_set_service

router = APIRouter()


@router.get("/{workout_id}/sets", response_model=list[WorkoutSetResponse])
def list_sets(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all sets for a workout, ordered by set number."""
    return workout_set_service.get_sets_for_workout(db, workout_id, current_user.id)


@router.post(
    "/{workout_id}/sets", status_code=201, response_model=WorkoutSetResponse
)
def create_set(
    workout_id: int,
    data: WorkoutSetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a set to a workout."""
    return workout_set_service.create_set(db, workout_id, current_user.id, data)


@router.put("/{workout_id}/sets/{set_id}", response_model=WorkoutSetResponse)
def update_set(
    workout_id: int,
    set_id: int,
    data: WorkoutSetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a set's weight, reps, or RPE."""
    return workout_set_service.update_set(
        db, workout_id, set_id, current_user.id, data
    )


@router.delete("/{workout_id}/sets/{set_id}", status_code=204)
def delete_set(
    workout_id: int,
    set_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a set from a workout."""
    workout_set_service.delete_set(db, workout_id, set_id, current_user.id)
