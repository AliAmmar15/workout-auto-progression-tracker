import pytest
from fastapi import HTTPException

from app.schemas.exercise import ExerciseCreate, ExerciseUpdate
from app.services.exercise_service import (
    get_all_exercises,
    get_exercise_by_id,
    get_exercise_by_name,
    create_exercise,
    update_exercise,
    delete_exercise,
)


# ---------------------------------------------------------------------------
# Existing CRUD tests (unchanged behaviour)
# ---------------------------------------------------------------------------

def test_create_exercise_success(db_session):
    # "A Pullup" is not a known alias, so it is stored as-is
    data = ExerciseCreate(name="A Pullup", muscle_group="Back", equipment="Bodyweight")
    exercise = create_exercise(db_session, data)

    assert exercise.id is not None
    assert exercise.name == "A Pullup"
    assert exercise.muscle_group == "Back"
    assert exercise.equipment == "Bodyweight"


def test_create_exercise_duplicate_name(db_session):
    data1 = ExerciseCreate(name="MyCustomExercise", muscle_group="Legs", equipment="Barbell")
    create_exercise(db_session, data1)

    data2 = ExerciseCreate(name="MyCustomExercise", muscle_group="Back", equipment="Dummy")
    with pytest.raises(HTTPException) as exc_info:
        create_exercise(db_session, data2)

    assert exc_info.value.status_code == 409


def test_get_all_exercises(db_session):
    data1 = ExerciseCreate(name="A Exercise", muscle_group="Back")
    data2 = ExerciseCreate(name="B Exercise", muscle_group="Chest")
    create_exercise(db_session, data1)
    create_exercise(db_session, data2)

    exercises = get_all_exercises(db_session)
    assert len(exercises) == 2
    assert exercises[0].name == "A Exercise"
    assert exercises[1].name == "B Exercise"


def test_get_all_exercises_filtered(db_session):
    data1 = ExerciseCreate(name="Curls", muscle_group="Arms")
    data2 = ExerciseCreate(name="Tricep Extensions", muscle_group="Arms")
    data3 = ExerciseCreate(name="Situps", muscle_group="Core")
    create_exercise(db_session, data1)
    create_exercise(db_session, data2)
    create_exercise(db_session, data3)

    exercises = get_all_exercises(db_session, muscle_group="Arms")
    assert len(exercises) == 2
    assert all(e.muscle_group == "Arms" for e in exercises)


def test_get_exercise_by_id_success(db_session):
    # "Lunge" normalizes to the canonical display name "Walking Lunge"
    data = ExerciseCreate(name="Lunge", muscle_group="Legs")
    created = create_exercise(db_session, data)

    fetched = get_exercise_by_id(db_session, created.id)
    assert fetched.id == created.id
    assert fetched.name == "Walking Lunge"


def test_get_exercise_by_id_not_found(db_session):
    with pytest.raises(HTTPException) as exc_info:
        get_exercise_by_id(db_session, 999)
    assert exc_info.value.status_code == 404


def test_update_exercise_success(db_session):
    data = ExerciseCreate(name="Row", muscle_group="Back")
    created = create_exercise(db_session, data)

    update_data = ExerciseUpdate(name="Custom Row", equipment="Barbell")
    updated = update_exercise(db_session, created.id, update_data)

    assert updated.name == "Custom Row"
    assert updated.muscle_group == "Back"
    assert updated.equipment == "Barbell"


def test_update_exercise_duplicate_name(db_session):
    data1 = ExerciseCreate(name="Ex1", muscle_group="G1")
    data2 = ExerciseCreate(name="Ex2", muscle_group="G2")
    created1 = create_exercise(db_session, data1)
    create_exercise(db_session, data2)

    update_data = ExerciseUpdate(name="Ex2")
    with pytest.raises(HTTPException) as exc_info:
        update_exercise(db_session, created1.id, update_data)

    assert exc_info.value.status_code == 409


def test_delete_exercise_success(db_session):
    data = ExerciseCreate(name="MyCustomDeadlift", muscle_group="Back")
    created = create_exercise(db_session, data)

    delete_exercise(db_session, created.id)

    with pytest.raises(HTTPException):
        get_exercise_by_id(db_session, created.id)


# ---------------------------------------------------------------------------
# Normalization tests (canonical exercise system)
# ---------------------------------------------------------------------------

class TestExerciseNormalization:
    def test_alias_resolves_to_canonical_display_name(self, db_session):
        """Creating 'bb bench' should store 'Bench Press' (canonical display name)."""
        data = ExerciseCreate(name="bb bench", muscle_group="Chest")
        exercise = create_exercise(db_session, data)
        assert exercise.name == "Bench Press"

    def test_canonical_alias_auto_populates_metadata(self, db_session):
        """Registry metadata (type, rep range, rate) should be auto-set."""
        data = ExerciseCreate(name="barbell bench press", muscle_group="Chest")
        exercise = create_exercise(db_session, data)
        assert exercise.exercise_type == "compound"
        assert exercise.rep_range_min == 5
        assert exercise.rep_range_max == 12
        assert exercise.progression_rate == 0.025

    def test_different_aliases_same_canonical_raises_409(self, db_session):
        """'bench press' and 'bb bench' must map to same canonical → second raises 409."""
        data1 = ExerciseCreate(name="bench press", muscle_group="Chest")
        create_exercise(db_session, data1)

        data2 = ExerciseCreate(name="bb bench", muscle_group="Chest")
        with pytest.raises(HTTPException) as exc_info:
            create_exercise(db_session, data2)
        assert exc_info.value.status_code == 409

    def test_exact_canonical_name_raises_409_on_duplicate(self, db_session):
        """Creating 'Bench Press' twice raises 409."""
        data1 = ExerciseCreate(name="Bench Press", muscle_group="Chest")
        create_exercise(db_session, data1)

        data2 = ExerciseCreate(name="bench press", muscle_group="Chest")
        with pytest.raises(HTTPException) as exc_info:
            create_exercise(db_session, data2)
        assert exc_info.value.status_code == 409

    def test_unknown_name_stored_as_is(self, db_session):
        """A name not in the registry is stored verbatim with user-supplied data."""
        data = ExerciseCreate(
            name="Cable Woodchop",
            muscle_group="Core",
            exercise_type="isolation",
            rep_range_min=12,
            rep_range_max=20,
        )
        exercise = create_exercise(db_session, data)
        assert exercise.name == "Cable Woodchop"
        assert exercise.exercise_type == "isolation"
        assert exercise.rep_range_min == 12

    def test_get_exercise_by_alias(self, db_session):
        """get_exercise_by_name with alias should return the canonical record."""
        data = ExerciseCreate(name="Bench Press", muscle_group="Chest")
        created = create_exercise(db_session, data)

        # Use the alias to fetch
        fetched = get_exercise_by_name(db_session, "barbell bench press")
        assert fetched.id == created.id
        assert fetched.name == "Bench Press"

    def test_get_exercise_by_name_display_name(self, db_session):
        """get_exercise_by_name with exact display name returns the record."""
        data = ExerciseCreate(name="Deadlift", muscle_group="Back")
        created = create_exercise(db_session, data)

        fetched = get_exercise_by_name(db_session, "deadlift")
        assert fetched.id == created.id

    def test_get_exercise_by_name_not_found_raises_404(self, db_session):
        """Completely unknown name raises 404."""
        with pytest.raises(HTTPException) as exc_info:
            get_exercise_by_name(db_session, "Completely Unknown Exercise XYZ")
        assert exc_info.value.status_code == 404

    def test_squat_aliases(self, db_session):
        """'squat', 'back squat', 'barbell squat' all map to Barbell Squat."""
        data = ExerciseCreate(name="squat", muscle_group="Legs")
        exercise = create_exercise(db_session, data)
        assert exercise.name == "Barbell Squat"

        # Second alias should raise 409 (same canonical)
        with pytest.raises(HTTPException) as exc_info:
            create_exercise(db_session, ExerciseCreate(name="back squat", muscle_group="Legs"))
        assert exc_info.value.status_code == 409

    def test_deadlift_has_high_progression_rate(self, db_session):
        """Deadlift is a lower-body compound and should have a higher progression rate."""
        data = ExerciseCreate(name="Deadlift", muscle_group="Back")
        exercise = create_exercise(db_session, data)
        assert exercise.progression_rate == 0.05
        assert exercise.exercise_type == "compound"

