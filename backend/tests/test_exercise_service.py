import pytest
from fastapi import HTTPException

from app.schemas.exercise import ExerciseCreate, ExerciseUpdate
from app.services.exercise_service import (
    get_all_exercises,
    get_exercise_by_id,
    create_exercise,
    update_exercise,
    delete_exercise
)

def test_create_exercise_success(db_session):
    data = ExerciseCreate(name="Bench Press", muscle_group="Chest", equipment="Barbell")
    exercise = create_exercise(db_session, data)
    
    assert exercise.id is not None
    assert exercise.name == "Bench Press"
    assert exercise.muscle_group == "Chest"
    assert exercise.equipment == "Barbell"


def test_create_exercise_duplicate_name(db_session):
    data1 = ExerciseCreate(name="Squat", muscle_group="Legs", equipment="Barbell")
    create_exercise(db_session, data1)
    
    data2 = ExerciseCreate(name="Squat", muscle_group="Back", equipment="Dummy")
    with pytest.raises(HTTPException) as exc_info:
        create_exercise(db_session, data2)
    
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Exercise name already exists"


def test_get_all_exercises(db_session):
    # Setup multiple exercises
    data1 = ExerciseCreate(name="A Pullup", muscle_group="Back")
    data2 = ExerciseCreate(name="B Pushup", muscle_group="Chest")
    create_exercise(db_session, data1)
    create_exercise(db_session, data2)
    
    exercises = get_all_exercises(db_session)
    assert len(exercises) == 2
    # Should be ordered by name ascending
    assert exercises[0].name == "A Pullup"
    assert exercises[1].name == "B Pushup"
    
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
    data = ExerciseCreate(name="Lunge", muscle_group="Legs")
    created = create_exercise(db_session, data)
    
    fetched = get_exercise_by_id(db_session, created.id)
    assert fetched.id == created.id
    assert fetched.name == "Lunge"

def test_get_exercise_by_id_not_found(db_session):
    with pytest.raises(HTTPException) as exc_info:
        get_exercise_by_id(db_session, 999)
    assert exc_info.value.status_code == 404

def test_update_exercise_success(db_session):
    data = ExerciseCreate(name="Row", muscle_group="Back")
    created = create_exercise(db_session, data)
    
    update_data = ExerciseUpdate(name="Barbell Row", equipment="Barbell")
    updated = update_exercise(db_session, created.id, update_data)
    
    assert updated.name == "Barbell Row"
    assert updated.muscle_group == "Back" # Unchanged
    assert updated.equipment == "Barbell"
    
def test_update_exercise_duplicate_name(db_session):
    data1 = ExerciseCreate(name="Ex1", muscle_group="G1")
    data2 = ExerciseCreate(name="Ex2", muscle_group="G2")
    created1 = create_exercise(db_session, data1)
    created2 = create_exercise(db_session, data2)
    
    update_data = ExerciseUpdate(name="Ex2")
    with pytest.raises(HTTPException) as exc_info:
        update_exercise(db_session, created1.id, update_data)
    
    assert exc_info.value.status_code == 409

def test_delete_exercise_success(db_session):
    data = ExerciseCreate(name="Deadlift", muscle_group="Back")
    created = create_exercise(db_session, data)
    
    delete_exercise(db_session, created.id)
    
    with pytest.raises(HTTPException):
        get_exercise_by_id(db_session, created.id)
