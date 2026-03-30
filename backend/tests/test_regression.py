"""
Regression Test Suite — Progression System

Purpose:
    Verify that the progression engine produces consistent, expected outputs
    across multi-session workout sequences. These tests guard against
    regressions when the algorithm is modified.

Each scenario simulates a realistic training block with multiple sessions
and asserts the final recommendation matches the expected behaviour.

Rep range defaults (exercise has no metadata): rep_min=5, rep_max=12.
  reps >= 12 → "success"   → +2.5%
  5 <= reps < 12 → "near_success" → maintain
  reps < 5  → "failure"  → -2.5%
"""
import pytest
from datetime import date, timedelta
from fastapi import HTTPException

from app.models.exercise import Exercise
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.services.progression_service import (
    evaluate_workout_success_legacy,
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
    Three sessions where the user hits the max rep target (12 reps).
    The system must recommend a weight increase of 2.5% after each session.
    Regression guard: a change to calculate_next_weight must not silently
    drop the increase or apply it incorrectly.
    """
    # reps=12 → evaluate_rep_range(12, 5, 12) → "success" → +2.5%
    weights = [100.0, 102.5, 105.06]  # 100 → +2.5% → +2.5%

    for i, w in enumerate(weights):
        add_session(db_session, test_user.id, squat.id, w, 12, days_ago=3 - i)

    rec = generate_recommendation(db_session, test_user.id, squat.id)
    expected = round(105.06 * 1.025, 2)  # 107.69

    assert rec["is_deload"] is False
    assert rec["action"] == "increase"
    assert rec["next_weight"] == expected


# ---------------------------------------------------------------------------
# Scenario 2: Isolated failure → weight decreases
# ---------------------------------------------------------------------------

def test_regression_single_failure_decreases_weight(db_session, test_user, squat):
    """
    A single isolated failure session (preceded by a success) must reduce weight by 2.5%.
    This tests the failure → calculate_next_weight path without triggering the plateau.

    Regression guard: a change to calculate_next_weight must not silently return
    the same weight or increase it when outcome is 'failure'.

    Note: 3 consecutive non-successes correctly trigger the plateau deload path
    (detect_plateau fires). This test isolates the failure branch by ensuring
    only the last session is a failure (last=2 outcomes → no plateau).
    """
    # One success first (reps=12) to prevent plateau (only 2 sessions total)
    add_session(db_session, test_user.id, squat.id, 100.0, 12, days_ago=2)
    # Then a hard failure: 2 reps < min(5) → "failure"
    add_session(db_session, test_user.id, squat.id, 100.0, 2, days_ago=1)

    rec = generate_recommendation(db_session, test_user.id, squat.id)
    expected = round(100.0 * 0.975, 2)  # 97.5

    assert rec["is_deload"] is False
    assert rec["action"] == "decrease"
    assert rec["next_weight"] == expected


# ---------------------------------------------------------------------------
# Scenario 3: 3 failure sessions → plateau → deload triggered
# ---------------------------------------------------------------------------

def test_regression_plateau_triggers_deload(db_session, test_user, squat):
    """
    Three consecutive failure sessions (4 reps vs min=5 → failure each time).
    detect_plateau should fire and the recommendation must be a deload.
    Regression guard: plateau detection must not regress to only checking
    weight equality (the old weight-comparison algorithm).
    """
    # 4 reps < min(5) → "failure" each time → 3 non-success → plateau
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=3)
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=2)
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=1)

    rec = generate_recommendation(db_session, test_user.id, squat.id)

    assert rec["is_deload"] is True
    assert rec["action"] == "deload"
    assert rec["next_weight"] == 90.0   # 100 * 0.9
    assert "plateau" in rec["reasoning"].lower() or "Plateau" in rec["reasoning"]


# ---------------------------------------------------------------------------
# Scenario 4: Post-deload session with success → resumes positive progression
# ---------------------------------------------------------------------------

def test_regression_post_deload_recovery(db_session, test_user, squat):
    """
    After 3 failures the system deloads. The next session performs the deloaded
    weight successfully (12 reps). That new recommendation must increase weight again.
    Regression guard: the engine must not remain stuck in deload state when
    the user resumes successful sessions.
    """
    # 3 failures (4 reps < min=5) → would have resulted in deload recommendation
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=4)
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=3)
    add_session(db_session, test_user.id, squat.id, 100.0, 4, days_ago=2)
    # User follows deload: lifts 90 kg and hits all 12 reps → "success"
    add_session(db_session, test_user.id, squat.id, 90.0, 12, days_ago=1)

    rec = generate_recommendation(db_session, test_user.id, squat.id)

    # Last 3 outcomes: failure, failure, success → no plateau (success breaks it)
    assert rec["is_deload"] is False
    assert rec["action"] == "increase"
    assert rec["next_weight"] == round(90.0 * 1.025, 2)  # 92.25


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
    add_session(db_session, test_user.id, squat.id, 100.0, 12, days_ago=3)
    add_session(db_session, test_user.id, squat.id, 105.0, 12, days_ago=2)
    # New all-time high weight, even though reps were a failure (2 reps < min=5)
    add_session(db_session, test_user.id, squat.id, 120.0, 2, days_ago=1)

    analysis = analyze_progression(db_session, test_user.id, squat.id)

    assert analysis["is_pr"] is True   # 120 > previous max of 105
    assert analysis["last_outcome"] == "failure"   # 2 reps < rep_min=5
