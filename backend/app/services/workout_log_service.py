from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.exercise import Exercise
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.schemas.workout_log import WorkoutLogCreate


def log_workout(db: Session, user_id: int, data: WorkoutLogCreate) -> Workout:
    """Log a complete workout with all sets in a single transaction.

    This is the primary workout logging endpoint. It creates a workout and
    all associated sets atomically — either everything succeeds or nothing
    is persisted. This prevents partial workout records in the database.

    Validates that all referenced exercise IDs exist before creating any
    records. If any exercise_id is invalid, the entire request is rejected
    with a 404 error.

    Steps:
    1. Collect unique exercise IDs from the sets
    2. Validate all exercises exist in a single query
    3. Create the workout record
    4. Create all set records linked to the workout
    5. Commit the transaction
    6. Return the workout with sets eagerly loaded
    """
    # Validate all exercise IDs exist
    exercise_ids = {s.exercise_id for s in data.sets}
    existing = (
        db.query(Exercise.id).filter(Exercise.id.in_(exercise_ids)).all()
    )
    found_ids = {row[0] for row in existing}
    missing = exercise_ids - found_ids
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Exercise(s) not found: {sorted(missing)}",
        )

    # Create workout
    workout = Workout(
        user_id=user_id,
        date=data.date,
        notes=data.notes,
    )
    db.add(workout)
    db.flush()  # Get the workout.id without committing

    # Create all sets
    for set_data in data.sets:
        workout_set = WorkoutSet(
            workout_id=workout.id,
            exercise_id=set_data.exercise_id,
            set_number=set_data.set_number,
            weight=set_data.weight,
            reps=set_data.reps,
            rpe=set_data.rpe,
        )
        db.add(workout_set)

    db.commit()

    # Reload with sets eagerly loaded for the response
    result = (
        db.query(Workout)
        .options(joinedload(Workout.sets))
        .filter(Workout.id == workout.id)
        .first()
    )
    return result
