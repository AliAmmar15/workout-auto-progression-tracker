import re
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.exercise import Exercise
from app.schemas.exercise import CustomExerciseCreate, ExerciseCreate, ExerciseUpdate
from app.utils.exercise_registry import normalize_exercise_name, get_exercise_metadata


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _as_exercise_id(exercise_id: UUID | str) -> str:
    return str(exercise_id)


def _normalize_display_name(raw: str) -> str:
    cleaned = " ".join(raw.strip().split())
    if not cleaned:
        raise HTTPException(status_code=422, detail="Exercise name cannot be empty")
    return cleaned


def _canonical_from_display_name(display_name: str) -> str:
    lowered = display_name.lower()
    canonical = re.sub(r"[^a-z0-9]+", "_", lowered).strip("_")
    return canonical


def _visible_exercises_query(db: Session, user_id: Optional[int]):
    query = db.query(Exercise)
    if user_id is None:
        return query.filter(Exercise.is_custom.is_(False))
    return query.filter(
        or_(Exercise.is_custom.is_(False), Exercise.user_id == user_id)
    )


def _lookup_canonical(
    db: Session, canonical_name: str, user_id: Optional[int] = None
) -> Optional[Exercise]:
    return (
        _visible_exercises_query(db, user_id)
        .filter(Exercise.canonical_name == canonical_name)
        .first()
    )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def get_all_exercises(
    db: Session, muscle_group: Optional[str] = None, user_id: Optional[int] = None
) -> list[Exercise]:
    """Return visible exercises (defaults + current user's custom), optionally filtered."""
    query = _visible_exercises_query(db, user_id)
    if muscle_group:
        query = query.filter(Exercise.muscle_group == muscle_group)
    return query.order_by(Exercise.display_name).all()


def get_exercise_by_id(
    db: Session, exercise_id: UUID | str, user_id: Optional[int] = None
) -> Exercise:
    """Return a single exercise or raise 404."""
    exercise = (
        _visible_exercises_query(db, user_id)
        .filter(Exercise.id == _as_exercise_id(exercise_id))
        .first()
    )
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


def get_exercise_by_name(db: Session, name: str, user_id: Optional[int] = None) -> Exercise:
    """Return an exercise by user-supplied name (supports aliases).

    1. Try to normalize the name via the registry.
    2. If canonical match → look up by registry display_name in DB.
    3. If no canonical match → fall back to exact DB name lookup.
    4. Raises 404 if still not found.
    """
    canonical = normalize_exercise_name(name)
    if canonical:
        exercise = _lookup_canonical(db, canonical, user_id)
        if exercise:
            return exercise

    # Exact name fallback (handles custom exercises not in registry)
    normalized_name = _normalize_display_name(name)
    exercise = (
        _visible_exercises_query(db, user_id)
        .filter(Exercise.display_name == normalized_name)
        .first()
    )
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
    normalized_name = _normalize_display_name(data.name)
    canonical = normalize_exercise_name(normalized_name)

    if canonical:
        # Check whether this canonical exercise already exists in the DB
        existing = db.query(Exercise).filter(Exercise.canonical_name == canonical).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Exercise already exists as '{existing.display_name}' "
                    f"(canonical: {canonical})"
                ),
            )
        # Auto-populate from registry
        meta = get_exercise_metadata(canonical)
        exercise = Exercise(
            canonical_name=canonical,
            display_name=meta["display_name"],
            muscle_group=meta.get("muscle_group", data.muscle_group),
            equipment=meta.get("equipment", data.equipment or "none"),
            is_custom=False,
            user_id=None,
            exercise_type=meta.get("exercise_type"),
            rep_range_min=meta.get("rep_range_min"),
            rep_range_max=meta.get("rep_range_max"),
            progression_rate=meta.get("progression_rate"),
        )
    else:
        # Unknown exercise — use exact name and supplied metadata
        generated_canonical = _canonical_from_display_name(normalized_name)
        existing = (
            db.query(Exercise)
            .filter(Exercise.canonical_name == generated_canonical, Exercise.user_id.is_(None))
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Exercise name already exists")
        exercise = Exercise(
            canonical_name=generated_canonical,
            display_name=normalized_name,
            muscle_group=data.muscle_group,
            equipment=data.equipment or "none",
            is_custom=False,
            user_id=None,
            exercise_type=data.exercise_type,
            rep_range_min=data.rep_range_min,
            rep_range_max=data.rep_range_max,
            progression_rate=data.progression_rate,
        )

    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


def create_custom_exercise(db: Session, user_id: int, data: CustomExerciseCreate) -> Exercise:
    """Create a custom exercise owned by the authenticated user."""
    normalized_name = _normalize_display_name(data.display_name)

    known_canonical = normalize_exercise_name(normalized_name)
    canonical_name = known_canonical or _canonical_from_display_name(normalized_name)

    duplicate = (
        _visible_exercises_query(db, user_id)
        .filter(Exercise.canonical_name == canonical_name)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Exercise already exists")

    exercise = Exercise(
        canonical_name=canonical_name,
        display_name=normalized_name,
        muscle_group=data.muscle_group,
        equipment=data.equipment.lower(),
        is_custom=True,
        user_id=user_id,
        exercise_type=None,
        rep_range_min=None,
        rep_range_max=None,
        progression_rate=None,
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


def update_exercise(
    db: Session, exercise_id: UUID | str, data: ExerciseUpdate
) -> Exercise:
    """Update an existing exercise. Raises 404 if not found, 409 on duplicate name."""
    exercise = get_exercise_by_id(db, exercise_id)

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        normalized_name = _normalize_display_name(update_data["name"])
        update_data["display_name"] = normalized_name
        if exercise.is_custom:
            update_data["canonical_name"] = _canonical_from_display_name(normalized_name)
        else:
            registry_canonical = normalize_exercise_name(normalized_name)
            update_data["canonical_name"] = registry_canonical or _canonical_from_display_name(normalized_name)
        existing = (
            db.query(Exercise)
            .filter(
                Exercise.canonical_name == update_data["canonical_name"],
                Exercise.user_id == exercise.user_id,
                Exercise.id != _as_exercise_id(exercise_id),
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Exercise name already exists")
        update_data.pop("name")

    for field, value in update_data.items():
        setattr(exercise, field, value)

    db.commit()
    db.refresh(exercise)
    return exercise


def delete_exercise(db: Session, exercise_id: UUID | str) -> None:
    """Delete an exercise. Raises 404 if not found."""
    exercise = get_exercise_by_id(db, exercise_id)
    db.delete(exercise)
    db.commit()

