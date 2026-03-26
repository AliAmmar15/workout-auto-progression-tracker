"""
Regression Test Suite — Progression System

Purpose:
    Verify that the progression engine produces consistent, expected outputs
    across multi-session workout sequences. These tests guard against
    regressions when the algorithm is modified.

Each scenario simulates a realistic training block with multiple sessions
and asserts the final recommendation matches the expected behaviour.
"""
import pytest
from datetime import date, timedelta
from fastapi import HTTPException

from app.models.exercise import Exercise
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.services.progression_service import (
    evaluate_workout_success,
    calculate_next_weight,
    detect_plateau,
    analyze_progression,
    generate_recommendation,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def squat(db_session):
    exercise = Exercise(name="Squat", muscle_group="Legs")
    db_session.add(exercise)
    db_session.commit()
    db_session.refresh(exercise)
    return exercise


def add_session(db_session, user_id, exercise_id, weight, reps, days_ago):
    """Create a workout session with a single set on a past date."""
    session_date = date.today() - timedelta(days=days_ago)
    workout = Workout(user_id=user_id, date=session_date)
    db_session.add(workout)
    db_session.commit()
    ws = WorkoutSet(
        workout_id=workout.id,
        exercise_id=exercise_id,
        set_number=1,
        weight=weight,
        reps=reps,
    )
    db_session.add(ws)
    db_session.commit()


# ---------------------------------------------------------------------------
# Scenario 1: Three sessions of success → weight increases each rec
# ---------------------------------------------------------------------------

def test_regression_consecutive_successes_increase_weight(db_session, test_user, squat):
    """
    Three sessions where the user hits all target reps.
    The system must recommend a weight increase after each session.
    Regression guard: a change to calculate_next_weight must not silently
    drop the increase or apply it incorrectly.
    """
    target = 5
    weights = [100.0, 105.0, 110.25]  # 100 → +5% → +5%

    for i, w in enumerate(weights):
        add_session(db_session, test_user.id, squat.id, w, target, days_ago=3 - i)

    rec = generate_recommendation(db_session, test_user.id, squat.id, target_reps=target)
    expected = round(110.25 * 1.05, 2)  # 115.76

    assert rec["is_deload"] is False
    assert rec["recommended_weight"] == expected
    assert "Increasing" in rec["reasoning"]


# ---------------------------------------------------------------------------
# Scenario 2: Three sessions of failure → weight decreases each rec
# ---------------------------------------------------------------------------

def test_regression_single_failure_decreases_weight(db_session, test_user, squat):
    """
    A single isolated failure session (preceded by a success) must reduce weight by 5%.
    This tests the failure → calculate_next_weight path without triggering the plateau.

    Regression guard: a change to calculate_next_weight must not silently return
    the same weight or increase it when outcome is 'failure'.

    Note: 3 consecutive failures correctly trigger the plateau deload path instead
    (detect_plateau fires when last 3 outcomes are all non-success). This test
    isolates the failure branch by ensuring only the last session is a failure.
    """
    target = 5
    # One success first to prevent plateau
    add_session(db_session, test_user.id, squat.id, 100.0, 5, days_ago=2)
    # Then a hard failure (2 reps vs target 5 → 3 missed → "failure")
    add_session(db_session, test_user.id, squat.id, 100.0, 2, days_ago=1)

    rec = generate_recommendation(db_session, test_user.id, squat.id, target_reps=target)
    expected = round(100.0 * 0.95, 2)  # 95.0

    assert rec["is_deload"] is False
    assert rec["recommended_weight"] == expected
    assert "reps missed" in rec["reasoning"]


# ---------------------------------------------------------------------------
# Scenario 3: 3 partial sessions → plateau → deload triggered
# ---------------------------------------------------------------------------

def test_regression_plateau_triggers_deload(db_session, test_user, squat):
    """
    Three consecutive partial-failure sessions (4 reps vs target 5 → 1 missed).
    detect_plateau should fire and the recommendation must be a deload.
    Regression guard: plateau detection must not regress to only checking
    weight equality (the old weight-comparison algorithm).
    """
    target = 5
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=3)
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=2)
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=1)

    rec = generate_recommendation(db_session, test_user.id, squat.id, target_reps=target)

    assert rec["is_deload"] is True
    assert rec["recommended_weight"] == 90.0   # 100 * 0.9
    assert "Plateau" in rec["reasoning"]


# ---------------------------------------------------------------------------
# Scenario 4: Post-deload session with success → resumes positive progression
# ---------------------------------------------------------------------------

def test_regression_post_deload_recovery(db_session, test_user, squat):
    """
    After 3 partials the system deloads. The next session performs the deloaded
    weight successfully. That new recommendation must increase weight again.
    Regression guard: the engine must not remain stuck in deload state when
    the user resumes successful sessions.
    """
    target = 5
    # 3 partials first (would have resulted in deload recommendation)
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=4)
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=3)
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=2)
    # User follows deload: lifts 90 kg and hits all 5 reps
    add_session(db_session, test_user.id, squat.id, 90.0, 5, days_ago=1)

    rec = generate_recommendation(db_session, test_user.id, squat.id, target_reps=target)

    # Last 3 outcomes are: partial, partial, success → no plateau
    assert rec["is_deload"] is False
    assert rec["recommended_weight"] == round(90.0 * 1.05, 2)  # 94.5
    assert "Increasing" in rec["reasoning"]


# ---------------------------------------------------------------------------
# Scenario 5: PR detection is preserved after algorithm change
# ---------------------------------------------------------------------------

def test_regression_pr_detection_preserved(db_session, test_user, squat):
    """
    Ensure that PR detection logic still works correctly after the reps-based
    refactor. Lifting a new all-time max weight must set is_pr=True regardless
    of whether it was a success/partial/failure on reps.
    Regression guard: PR logic must remain independent of reps outcome.
    """
    add_session(db_session, test_user.id, squat.id, 100.0, 5, days_ago=3)
    add_session(db_session, test_user.id, squat.id, 105.0, 5, days_ago=2)
    # New all-time high weight, even though reps were a failure (2 reps)
    add_session(db_session, test_user.id, squat.id, 120.0, 2, days_ago=1)

    analysis = analyze_progression(db_session, test_user.id, squat.id)

    assert analysis["is_pr"] is True   # 120 > previous max of 105
    assert analysis["last_outcome"] == "failure"   # but reps failed
