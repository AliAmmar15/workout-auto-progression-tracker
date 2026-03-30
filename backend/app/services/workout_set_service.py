from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.models.exercise import Exercise
from app.schemas.workout_set import WorkoutSetCreate, WorkoutSetUpdate


def _verify_workout_ownership(db: Session, workout_id: int, user_id: int) -> Workout:
    """Verify that the workout exists and belongs to the user.

    This shared helper is used by all workout_set operations to enforce
    data isolation. A user can only manage sets within their own workouts.
    Raises 404 if the workout does not exist or is not owned by the user.
    """
    workout = (
        db.query(Workout)
        .filter(Workout.id == workout_id, Workout.user_id == user_id)
        .first()
    )
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


def get_sets_for_workout(
    db: Session, workout_id: int, user_id: int
) -> list[WorkoutSet]:
    """Return all sets for a workout, ordered by set number.

    Verifies workout ownership before returning sets. Results are ordered
    by set_number ascending so they appear in the order they were performed.
    """
    _verify_workout_ownership(db, workout_id, user_id)
    return (
        db.query(WorkoutSet)
        .filter(WorkoutSet.workout_id == workout_id)
        .order_by(WorkoutSet.set_number)
        .all()
    )


def get_set_by_id(
    db: Session, workout_id: int, set_id: int, user_id: int
) -> WorkoutSet:
    """Return a single set, verifying it belongs to the specified workout.

    Checks workout ownership first, then verifies the set exists within
    that workout. Raises 404 if the set is not found.
    """
    _verify_workout_ownership(db, workout_id, user_id)
    workout_set = (
        db.query(WorkoutSet)
        .filter(WorkoutSet.id == set_id, WorkoutSet.workout_id == workout_id)
        .first()
    )
    if not workout_set:
        raise HTTPException(status_code=404, detail="Workout set not found")
    return workout_set


def create_set(
    db: Session, workout_id: int, user_id: int, data: WorkoutSetCreate
) -> WorkoutSet:
    """Add a new set to a workout.

    Verifies workout ownership and validates that the referenced exercise
    exists before creating the set. Raises 404 if the exercise_id does not
    correspond to a valid exercise in the database.
    """
    _verify_workout_ownership(db, workout_id, user_id)

    exercise = db.query(Exercise).filter(Exercise.id == data.exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    workout_set = WorkoutSet(
        workout_id=workout_id,
        exercise_id=str(data.exercise_id),
        set_number=data.set_number,
        weight=data.weight,
        reps=data.reps,
        rpe=data.rpe,
    )
    db.add(workout_set)
    db.commit()
    db.refresh(workout_set)
    return workout_set


def update_set(
    db: Session, workout_id: int, set_id: int, user_id: int, data: WorkoutSetUpdate
) -> WorkoutSet:
    """Update an existing set's weight, reps, or RPE.

    Verifies workout ownership and set existence. Only fields explicitly
    included in the request are updated using exclude_unset, preserving
    any values that were not provided.
    """
    workout_set = get_set_by_id(db, workout_id, set_id, user_id)
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(workout_set, field, value)

    db.commit()
    db.refresh(workout_set)
    return workout_set


def delete_set(
    db: Session, workout_id: int, set_id: int, user_id: int
) -> None:
    """Delete a set from a workout.

    Verifies workout ownership and set existence before deleting.
    Raises 404 if the set is not found or the workout is not owned by the user.
    """
    workout_set = get_set_by_id(db, workout_id, set_id, user_id)
    db.delete(workout_set)
    db.commit()
