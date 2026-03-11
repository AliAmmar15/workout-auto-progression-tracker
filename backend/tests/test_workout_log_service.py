import pytest
from datetime import date
from fastapi import HTTPException

from app.models.exercise import Exercise
from app.schemas.workout_set import WorkoutSetCreate
from app.schemas.workout_log import WorkoutLogCreate
from app.services.workout_log_service import log_workout

@pytest.fixture
def sample_exercises(db_session):
    e1 = Exercise(name="Squat", muscle_group="Legs")
    e2 = Exercise(name="Deadlift", muscle_group="Back")
    db_session.add(e1)
    db_session.add(e2)
    db_session.commit()
    db_session.refresh(e1)
    db_session.refresh(e2)
    return e1, e2

def test_log_workout_success(db_session, test_user, sample_exercises):
    e1, e2 = sample_exercises
    
    set1 = WorkoutSetCreate(exercise_id=e1.id, set_number=1, weight=225, reps=5)
    set2 = WorkoutSetCreate(exercise_id=e2.id, set_number=2, weight=315, reps=5)
    
    data = WorkoutLogCreate(
        date=date.today(),
        notes="Heavy day",
        sets=[set1, set2]
    )
    
    workout = log_workout(db_session, test_user.id, data)
    
    assert workout.id is not None
    assert workout.user_id == test_user.id
    assert workout.date == date.today()
    assert workout.notes == "Heavy day"
    
    assert len(workout.sets) == 2
    assert workout.sets[0].exercise_id == e1.id
    assert workout.sets[1].exercise_id == e2.id

def test_log_workout_invalid_exercise(db_session, test_user):
    set1 = WorkoutSetCreate(exercise_id=999, set_number=1, weight=225, reps=5) # Invalid ID
    
    data = WorkoutLogCreate(
        date=date.today(),
        sets=[set1]
    )
    
    with pytest.raises(HTTPException) as exc_info:
        log_workout(db_session, test_user.id, data)
        
    assert exc_info.value.status_code == 404
    assert "Exercise(s) not found" in exc_info.value.detail
