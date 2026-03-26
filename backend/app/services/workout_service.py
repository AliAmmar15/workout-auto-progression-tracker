from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.schemas.workout import WorkoutCreate, WorkoutUpdate


def get_user_workouts(
    db: Session,
    user_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> list[Workout]:
    """Return all workouts for a user, optionally filtered by date range.

    Results are ordered by date descending (most recent first) so the user
    sees their latest workouts at the top of the list.
    """
    query = (
        db.query(Workout)
        .options(joinedload(Workout.sets))
        .filter(Workout.user_id == user_id)
    )

    if date_from:
        query = query.filter(Workout.date >= date_from)
    if date_to:
        query = query.filter(Workout.date <= date_to)

    return query.order_by(Workout.date.desc()).all()


def get_workout_by_id(db: Session, workout_id: int, user_id: int) -> Workout:
    """Return a single workout with its sets eagerly loaded.

    Uses joinedload to fetch the related workout_sets in a single query,
    avoiding N+1 query issues when the response includes nested sets.
    Raises 404 if the workout does not exist or does not belong to the user.
    """
    workout = (
        db.query(Workout)
        .options(joinedload(Workout.sets).joinedload(WorkoutSet.exercise))
        .filter(Workout.id == workout_id, Workout.user_id == user_id)
        .first()
    )
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


def create_workout(db: Session, user_id: int, data: WorkoutCreate) -> Workout:
    """Create a new workout session for the given user.

    The workout is associated with the user via user_id and records the
    date of the session along with optional notes.
    """
    workout = Workout(
        user_id=user_id,
        date=data.date,
        notes=data.notes,
    )
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout


def update_workout(
    db: Session, workout_id: int, user_id: int, data: WorkoutUpdate
) -> Workout:
    """Update an existing workout's date or notes.

    Only fields that are explicitly provided in the request body are updated,
    preserving any fields that were not included. Raises 404 if the workout
    does not exist or does not belong to the user.
    """
    workout = get_workout_by_id(db, workout_id, user_id)
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(workout, field, value)

    db.commit()
    db.refresh(workout)
    return workout


def delete_workout(db: Session, workout_id: int, user_id: int) -> None:
    """Delete a workout and all of its associated sets.

    Due to the CASCADE delete rule on the workout_sets foreign key,
    all sets belonging to this workout are automatically removed.
    Raises 404 if the workout does not exist or does not belong to the user.
    """
    workout = get_workout_by_id(db, workout_id, user_id)
    db.delete(workout)
    db.commit()
