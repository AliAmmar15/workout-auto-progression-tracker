from datetime import date, timedelta
import pytest
from fastapi import HTTPException

from app.schemas.workout import WorkoutCreate, WorkoutUpdate
from app.services.workout_service import (
    get_user_workouts,
    get_workout_by_id,
    create_workout,
    update_workout,
    delete_workout
)

def test_create_workout_success(db_session, test_user):
    data = WorkoutCreate(date=date.today(), notes="Feeling strong")
    workout = create_workout(db_session, test_user.id, data)
    
    assert workout.id is not None
    assert workout.user_id == test_user.id
    assert workout.date == date.today()
    assert workout.notes == "Feeling strong"

def test_get_user_workouts(db_session, test_user):
    # Setup multiple workouts
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    data1 = WorkoutCreate(date=yesterday, notes="Yesterday")
    data2 = WorkoutCreate(date=today, notes="Today")
    create_workout(db_session, test_user.id, data1)
    create_workout(db_session, test_user.id, data2)
    
    workouts = get_user_workouts(db_session, test_user.id)
    assert len(workouts) == 2
    # Should be ordered by date desc
    assert workouts[0].date == today
    assert workouts[1].date == yesterday

def test_get_user_workouts_filtered(db_session, test_user):
    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)
    
    create_workout(db_session, test_user.id, WorkoutCreate(date=yesterday))
    create_workout(db_session, test_user.id, WorkoutCreate(date=today))
    create_workout(db_session, test_user.id, WorkoutCreate(date=tomorrow))
    
    # Filter between yesterday and today
    workouts = get_user_workouts(db_session, test_user.id, date_from=yesterday, date_to=today)
    assert len(workouts) == 2
    assert all(w.date <= today and w.date >= yesterday for w in workouts)

def test_get_workout_by_id_success(db_session, test_user):
    data = WorkoutCreate(date=date.today())
    created = create_workout(db_session, test_user.id, data)
    
    fetched = get_workout_by_id(db_session, created.id, test_user.id)
    assert fetched.id == created.id
    assert fetched.date == date.today()

def test_get_workout_by_id_not_found(db_session, test_user):
    with pytest.raises(HTTPException) as exc_info:
        get_workout_by_id(db_session, 999, test_user.id)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workout not found"

def test_get_workout_by_id_wrong_user(db_session, test_user):
    # Create workout for test_user
    data = WorkoutCreate(date=date.today())
    created = create_workout(db_session, test_user.id, data)
    
    # Try fetching with user_id = 999
    with pytest.raises(HTTPException) as exc_info:
        get_workout_by_id(db_session, created.id, 999)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workout not found"

def test_update_workout_success(db_session, test_user):
    data = WorkoutCreate(date=date.today(), notes="Old notes")
    created = create_workout(db_session, test_user.id, data)
    
    update_data = WorkoutUpdate(notes="New notes")
    updated = update_workout(db_session, created.id, test_user.id, update_data)
    
    assert updated.notes == "New notes"
    assert updated.date == date.today() # Unchanged

def test_delete_workout_success(db_session, test_user):
    data = WorkoutCreate(date=date.today())
    created = create_workout(db_session, test_user.id, data)
    
    delete_workout(db_session, created.id, test_user.id)
    
    with pytest.raises(HTTPException):
        get_workout_by_id(db_session, created.id, test_user.id)
