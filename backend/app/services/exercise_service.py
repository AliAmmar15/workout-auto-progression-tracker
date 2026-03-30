from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.exercise import Exercise
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate
from app.utils.exercise_registry import normalize_exercise_name, get_exercise_metadata


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _lookup_canonical(db: Session, canonical_name: str) -> Optional[Exercise]:
    """Find an existing Exercise by canonical_name stored in its name field.

    The canonical display_name (e.g. "Bench Press") is what is stored in the
    DB for exercises that were created via the registry.  We check the DB name
    against the registry's display_name for the supplied canonical key.
    """
    meta = get_exercise_metadata(canonical_name)
    if not meta:
        return None
    return (
        db.query(Exercise)
        .filter(Exercise.name == meta["display_name"])
        .first()
    )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

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


def get_exercise_by_name(db: Session, name: str) -> Exercise:
    """Return an exercise by user-supplied name (supports aliases).

    1. Try to normalize the name via the registry.
    2. If canonical match → look up by registry display_name in DB.
    3. If no canonical match → fall back to exact DB name lookup.
    4. Raises 404 if still not found.
    """
    canonical = normalize_exercise_name(name)
    if canonical:
        exercise = _lookup_canonical(db, canonical)
        if exercise:
            return exercise

    # Exact name fallback (handles custom exercises not in registry)
    exercise = db.query(Exercise).filter(Exercise.name == name).first()
    if not exercise:
        raise HTTPException(
            status_code=404,
            detail=f"Exercise '{name}' not found",
        )
    return exercise


def create_exercise(db: Session, data: ExerciseCreate) -> Exercise:
    """Create a new exercise.

    - If the supplied name resolves to a known canonical exercise, the display
      name from the registry is stored and metadata is auto-populated.  If that
      canonical exercise already exists in the DB a 409 is raised (prevents
      duplicates via aliases like 'bb bench' and 'bench press').
    - If the name is unknown, it is stored as-is with the user-supplied data.
    - Raises 409 on exact name collision for unknown exercises.
    """
    canonical = normalize_exercise_name(data.name)

    if canonical:
        # Check whether this canonical exercise already exists in the DB
        existing = _lookup_canonical(db, canonical)
        if existing:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Exercise already exists as '{existing.name}' "
                    f"(canonical: {canonical})"
                ),
            )
        # Auto-populate from registry
        meta = get_exercise_metadata(canonical)
        exercise = Exercise(
            name=meta["display_name"],
            muscle_group=meta.get("muscle_group", data.muscle_group),
            equipment=meta.get("equipment", data.equipment or "none"),
            exercise_type=meta.get("exercise_type"),
            rep_range_min=meta.get("rep_range_min"),
            rep_range_max=meta.get("rep_range_max"),
            progression_rate=meta.get("progression_rate"),
        )
    else:
        # Unknown exercise — use exact name and supplied metadata
        existing = db.query(Exercise).filter(Exercise.name == data.name).first()
        if existing:
            raise HTTPException(status_code=409, detail="Exercise name already exists")
        exercise = Exercise(
            name=data.name,
            muscle_group=data.muscle_group,
            equipment=data.equipment or "none",
            exercise_type=data.exercise_type,
            rep_range_min=data.rep_range_min,
            rep_range_max=data.rep_range_max,
            progression_rate=data.progression_rate,
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

