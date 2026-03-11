import pytest
from datetime import date, timedelta
from fastapi import HTTPException

from app.models.exercise import Exercise
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.services.progression_service import analyze_progression, generate_recommendation

@pytest.fixture
def sample_exercise(db_session):
    exercise = Exercise(name="Squat", muscle_group="Legs")
    db_session.add(exercise)
    db_session.commit()
    db_session.refresh(exercise)
    return exercise

def create_mock_sets(db_session, user_id, exercise_id, weights_and_reps):
    """Helper to create historical workout sets for progression testing"""
    base_date = date.today() - timedelta(days=len(weights_and_reps))
    
    for i, (weight, reps) in enumerate(weights_and_reps):
        workout = Workout(user_id=user_id, date=base_date + timedelta(days=i))
        db_session.add(workout)
        db_session.commit()
        
        workout_set = WorkoutSet(
            workout_id=workout.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=weight,
            reps=reps
        )
        db_session.add(workout_set)
        
    db_session.commit()

def test_analyze_progression_no_sets(db_session, test_user, sample_exercise):
    result = analyze_progression(db_session, test_user.id, sample_exercise.id)
    assert result["trend"] == "stable"
    assert result["plateau_detected"] is False
    assert result["is_pr"] is False

def test_analyze_progression_improving_trend(db_session, test_user, sample_exercise):
    create_mock_sets(db_session, test_user.id, sample_exercise.id, [
        (100, 5), (105, 5), (110, 5) # Strictly increasing last 3
    ])
    result = analyze_progression(db_session, test_user.id, sample_exercise.id)
    assert result["trend"] == "improving"
    assert result["is_pr"] is True # 110 is greater than previous max (105)

def test_analyze_progression_stagnating_trend(db_session, test_user, sample_exercise):
    create_mock_sets(db_session, test_user.id, sample_exercise.id, [
        (100, 5), (100, 5), (100, 5) # Same weight last 3
    ])
    result = analyze_progression(db_session, test_user.id, sample_exercise.id)
    assert result["trend"] == "stagnating"
    assert result["plateau_detected"] is True
    assert result["is_pr"] is False

def test_analyze_progression_regressing_trend(db_session, test_user, sample_exercise):
    create_mock_sets(db_session, test_user.id, sample_exercise.id, [
        (100, 5), (105, 5), (100, 5) # Latest is less than previous
    ])
    result = analyze_progression(db_session, test_user.id, sample_exercise.id)
    assert result["trend"] == "regressing"

def test_recommendation_plateau_deload(db_session, test_user, sample_exercise):
    create_mock_sets(db_session, test_user.id, sample_exercise.id, [
        (100, 5), (100, 5), (100, 5)
    ])
    rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
    assert rec["is_deload"] is True
    assert rec["recommended_weight"] == 90.0 # 100 * 0.9

def test_recommendation_improving_overload(db_session, test_user, sample_exercise):
    create_mock_sets(db_session, test_user.id, sample_exercise.id, [
        (100, 5), (105, 5), (110, 5)
    ])
    rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
    assert rec["is_deload"] is False
    assert rec["recommended_weight"] == 115.0 # 110 + 5.0

def test_invalid_exercise(db_session, test_user):
    with pytest.raises(HTTPException):
        analyze_progression(db_session, test_user.id, 999)
