from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.workout import (
    WorkoutCreate,
    WorkoutUpdate,
    WorkoutResponse,
    WorkoutDetailResponse,
)
from app.schemas.workout_log import WorkoutLogCreate, WorkoutLogResponse
from app.services import workout_service, workout_log_service

router = APIRouter()


@router.get("", response_model=list[WorkoutResponse])
def list_workouts(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List workouts for the authenticated user, optionally filtered by date range."""
    return workout_service.get_user_workouts(db, current_user.id, date_from, date_to)


@router.get("/{workout_id}", response_model=WorkoutDetailResponse)
def get_workout(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single workout with all its sets."""
    return workout_service.get_workout_by_id(db, workout_id, current_user.id)


@router.post("", status_code=201, response_model=WorkoutResponse)
def create_workout(
    data: WorkoutCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new empty workout (sets added separately)."""
    return workout_service.create_workout(db, current_user.id, data)


@router.post("/log", status_code=201, response_model=WorkoutLogResponse)
def log_full_workout(
    data: WorkoutLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log a complete workout with all sets in a single request.

    This is the primary workout logging endpoint. Accepts the workout
    date, optional notes, and an array of sets. Everything is created
    atomically in a single database transaction.
    """
    return workout_log_service.log_workout(db, current_user.id, data)


@router.put("/{workout_id}", response_model=WorkoutResponse)
def update_workout(
    workout_id: int,
    data: WorkoutUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing workout's date or notes."""
    return workout_service.update_workout(db, workout_id, current_user.id, data)


@router.delete("/{workout_id}", status_code=204)
def delete_workout(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a workout and all of its sets."""
    workout_service.delete_workout(db, workout_id, current_user.id)
