"""
Tests for progression_service.py

Covers:
  - Pure functions: evaluate_workout_success, calculate_next_weight, detect_plateau
  - Orchestrators: analyze_progression, generate_recommendation (DB integration)
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
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_exercise(db_session):
    exercise = Exercise(name="Squat", muscle_group="Legs")
    db_session.add(exercise)
    db_session.commit()
    db_session.refresh(exercise)
    return exercise


def create_mock_sets(db_session, user_id, exercise_id, weights_and_reps):
    """Helper: creates one workout per entry, each with a single set."""
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
            reps=reps,
        )
        db_session.add(workout_set)
    db_session.commit()


# ---------------------------------------------------------------------------
# Pure function: evaluate_workout_success
# ---------------------------------------------------------------------------

class TestEvaluateWorkoutSuccess:
    def test_exact_reps_met_is_success(self):
        assert evaluate_workout_success(5, 5) == "success"

    def test_more_reps_than_target_is_success(self):
        assert evaluate_workout_success(7, 5) == "success"

    def test_one_rep_missed_is_partial(self):
        assert evaluate_workout_success(4, 5) == "partial"

    def test_two_reps_missed_is_partial(self):
        assert evaluate_workout_success(3, 5) == "partial"

    def test_three_reps_missed_is_failure(self):
        assert evaluate_workout_success(2, 5) == "failure"

    def test_zero_reps_is_failure(self):
        assert evaluate_workout_success(0, 5) == "failure"

    def test_boundary_exactly_two_missed_is_partial(self):
        # 8 target, 6 actual → 2 missed → partial
        assert evaluate_workout_success(6, 8) == "partial"

    def test_boundary_three_missed_is_failure(self):
        # 8 target, 5 actual → 3 missed → failure
        assert evaluate_workout_success(5, 8) == "failure"


# ---------------------------------------------------------------------------
# Pure function: calculate_next_weight
# ---------------------------------------------------------------------------

class TestCalculateNextWeight:
    def test_success_increases_by_5_percent(self):
        result = calculate_next_weight(100.0, "success")
        assert result == 105.0

    def test_partial_maintains_weight(self):
        result = calculate_next_weight(100.0, "partial")
        assert result == 100.0

    def test_failure_decreases_by_5_percent(self):
        result = calculate_next_weight(100.0, "failure")
        assert result == 95.0

    def test_result_is_rounded_to_2_decimals(self):
        # 95.0 * 1.05 = 99.75 exactly
        result = calculate_next_weight(95.0, "success")
        assert result == 99.75

    def test_large_weight_success(self):
        result = calculate_next_weight(400.0, "success")
        assert result == 420.0

    def test_large_weight_failure(self):
        result = calculate_next_weight(400.0, "failure")
        assert result == 380.0


# ---------------------------------------------------------------------------
# Pure function: detect_plateau
# ---------------------------------------------------------------------------

class TestDetectPlateau:
    def test_three_partials_is_plateau(self):
        assert detect_plateau(["partial", "partial", "partial"]) is True

    def test_three_failures_is_plateau(self):
        assert detect_plateau(["failure", "failure", "failure"]) is True

    def test_mixed_partial_and_failure_is_plateau(self):
        assert detect_plateau(["partial", "failure", "partial"]) is True

    def test_one_success_breaks_plateau(self):
        assert detect_plateau(["partial", "partial", "success"]) is False

    def test_success_in_middle_breaks_plateau(self):
        assert detect_plateau(["partial", "success", "partial"]) is False

    def test_fewer_than_3_sessions_no_plateau(self):
        assert detect_plateau(["partial", "partial"]) is False
        assert detect_plateau(["failure"]) is False
        assert detect_plateau([]) is False

    def test_more_than_3_sessions_checks_last_three(self):
        # First two are success, last three all partial → plateau
        assert detect_plateau(["success", "success", "partial", "partial", "partial"]) is True
        # Last one success → no plateau
        assert detect_plateau(["partial", "partial", "partial", "success"]) is False


# ---------------------------------------------------------------------------
# Integration: analyze_progression
# ---------------------------------------------------------------------------

class TestAnalyzeProgression:
    def test_no_sets_returns_stable_defaults(self, db_session, test_user, sample_exercise):
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["trend"] == "stable"
        assert result["plateau_detected"] is False
        assert result["is_pr"] is False
        assert result["last_outcome"] is None

    def test_success_outcome_gives_improving_trend(self, db_session, test_user, sample_exercise):
        # 5 reps matches default target_reps=5 → success
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 5)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["trend"] == "improving"
        assert result["last_outcome"] == "success"

    def test_partial_outcome_gives_stable_trend(self, db_session, test_user, sample_exercise):
        # 4 reps with target 5 → 1 missed → partial
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 4)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["trend"] == "stable"
        assert result["last_outcome"] == "partial"

    def test_failure_outcome_gives_regressing_trend(self, db_session, test_user, sample_exercise):
        # 2 reps with target 5 → 3 missed → failure
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 2)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["trend"] == "regressing"
        assert result["last_outcome"] == "failure"

    def test_plateau_detected_after_3_partials(self, db_session, test_user, sample_exercise):
        # 4 reps each → partial each time → plateau
        create_mock_sets(db_session, test_user.id, sample_exercise.id,
                         [(100, 4), (100, 4), (100, 4)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["plateau_detected"] is True

    def test_pr_detected_on_first_set(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 5)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["is_pr"] is True

    def test_pr_detected_on_new_max(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 5), (110, 5)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["is_pr"] is True

    def test_no_pr_on_same_weight(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 5), (100, 5)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["is_pr"] is False

    def test_invalid_exercise_raises_404(self, db_session, test_user):
        with pytest.raises(HTTPException) as exc_info:
            analyze_progression(db_session, test_user.id, 999)
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Integration: generate_recommendation
# ---------------------------------------------------------------------------

class TestGenerateRecommendation:
    def test_no_data_returns_zero_weight(self, db_session, test_user, sample_exercise):
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["recommended_weight"] == 0.0
        assert rec["is_deload"] is False

    def test_success_increases_weight_by_5_percent(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 5)])
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["is_deload"] is False
        assert rec["recommended_weight"] == 105.0  # 100 * 1.05

    def test_partial_maintains_weight(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 4)])
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["is_deload"] is False
        assert rec["recommended_weight"] == 100.0

    def test_failure_decreases_weight_by_5_percent(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 2)])
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["is_deload"] is False
        assert rec["recommended_weight"] == 95.0  # 100 * 0.95

    def test_plateau_triggers_deload(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id,
                         [(100, 4), (100, 4), (100, 4)])
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["is_deload"] is True
        assert rec["recommended_weight"] == 90.0  # 100 * 0.9

    def test_custom_target_reps(self, db_session, test_user, sample_exercise):
        # With target_reps=8, performing 8 = success
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 8)])
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id, target_reps=8)
        assert rec["recommended_weight"] == 105.0  # success → +5%
