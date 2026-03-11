import pytest
from datetime import date
from fastapi import HTTPException

from app.models.exercise import Exercise
from app.models.workout import Workout
from app.schemas.workout_set import WorkoutSetCreate, WorkoutSetUpdate
from app.services.workout_set_service import (
    get_sets_for_workout,
    get_set_by_id,
    create_set,
    update_set,
    delete_set,
)

@pytest.fixture
def sample_workout(db_session, test_user):
    workout = Workout(user_id=test_user.id, date=date.today())
    db_session.add(workout)
    db_session.commit()
    db_session.refresh(workout)
    return workout

@pytest.fixture
def sample_exercise(db_session):
    exercise = Exercise(name="Bench Press", muscle_group="Chest")
    db_session.add(exercise)
    db_session.commit()
    db_session.refresh(exercise)
    return exercise

def test_create_set_success(db_session, test_user, sample_workout, sample_exercise):
    data = WorkoutSetCreate(
        exercise_id=sample_exercise.id,
        set_number=1,
        weight=135.5,
        reps=10,
        rpe=8
    )
    
    workout_set = create_set(db_session, sample_workout.id, test_user.id, data)
    
    assert workout_set.id is not None
    assert workout_set.workout_id == sample_workout.id
    assert workout_set.exercise_id == sample_exercise.id
    assert workout_set.set_number == 1
    assert workout_set.weight == 135.5
    assert workout_set.reps == 10
    assert workout_set.rpe == 8

def test_create_set_workout_not_found(db_session, test_user, sample_exercise):
    data = WorkoutSetCreate(
        exercise_id=sample_exercise.id,
        set_number=1,
        weight=135.5,
        reps=10
    )
    
    with pytest.raises(HTTPException) as exc_info:
        create_set(db_session, 999, test_user.id, data)
        
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workout not found"

def test_create_set_exercise_not_found(db_session, test_user, sample_workout):
    data = WorkoutSetCreate(
        exercise_id=999,
        set_number=1,
        weight=135.5,
        reps=10
    )
    
    with pytest.raises(HTTPException) as exc_info:
        create_set(db_session, sample_workout.id, test_user.id, data)
        
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Exercise not found"

def test_get_sets_for_workout(db_session, test_user, sample_workout, sample_exercise):
    set1 = WorkoutSetCreate(exercise_id=sample_exercise.id, set_number=1, weight=100, reps=10)
    set2 = WorkoutSetCreate(exercise_id=sample_exercise.id, set_number=2, weight=110, reps=8)
    
    create_set(db_session, sample_workout.id, test_user.id, set1)
    create_set(db_session, sample_workout.id, test_user.id, set2)
    
    sets = get_sets_for_workout(db_session, sample_workout.id, test_user.id)
    assert len(sets) == 2
    assert sets[0].set_number == 1
    assert sets[1].set_number == 2

def test_get_set_by_id_success(db_session, test_user, sample_workout, sample_exercise):
    data = WorkoutSetCreate(exercise_id=sample_exercise.id, set_number=1, weight=100, reps=10)
    created = create_set(db_session, sample_workout.id, test_user.id, data)
    
    fetched = get_set_by_id(db_session, sample_workout.id, created.id, test_user.id)
    assert fetched.id == created.id

def test_get_set_by_id_not_found(db_session, test_user, sample_workout):
    with pytest.raises(HTTPException) as exc_info:
        get_set_by_id(db_session, sample_workout.id, 999, test_user.id)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workout set not found"

def test_update_set_success(db_session, test_user, sample_workout, sample_exercise):
    data = WorkoutSetCreate(exercise_id=sample_exercise.id, set_number=1, weight=100, reps=10)
    created = create_set(db_session, sample_workout.id, test_user.id, data)
    
    update_data = WorkoutSetUpdate(weight=105, reps=9)
    updated = update_set(db_session, sample_workout.id, created.id, test_user.id, update_data)
    
    assert updated.weight == 105
    assert updated.reps == 9
    assert updated.set_number == 1 # Unchanged

def test_delete_set_success(db_session, test_user, sample_workout, sample_exercise):
    data = WorkoutSetCreate(exercise_id=sample_exercise.id, set_number=1, weight=100, reps=10)
    created = create_set(db_session, sample_workout.id, test_user.id, data)
    
    delete_set(db_session, sample_workout.id, created.id, test_user.id)
    
    with pytest.raises(HTTPException):
        get_set_by_id(db_session, sample_workout.id, created.id, test_user.id)
