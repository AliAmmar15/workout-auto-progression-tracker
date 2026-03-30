"""
Tests for progression_service.py

Covers:
  - Pure functions: evaluate_workout_success_legacy, evaluate_rep_range,
    get_user_progression_multiplier, calculate_next_weight, detect_plateau,
    detect_bodyweight_escalation
  - Orchestrators: analyze_progression, generate_recommendation (DB integration),
    compute_post_workout_progression
"""
import pytest
from datetime import date, timedelta
from fastapi import HTTPException

from app.models.exercise import Exercise
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.services.progression_service import (
    evaluate_workout_success_legacy,
    evaluate_rep_range,
    get_user_progression_multiplier,
    calculate_next_weight,
    detect_plateau,
    detect_bodyweight_escalation,
    analyze_progression,
    generate_recommendation,
    compute_post_workout_progression,
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
# Pure function: evaluate_workout_success_legacy
# ---------------------------------------------------------------------------

class TestEvaluateWorkoutSuccess:
    def test_exact_reps_met_is_success(self):
        assert evaluate_workout_success_legacy(5, 5) == "success"

    def test_more_reps_than_target_is_success(self):
        assert evaluate_workout_success_legacy(7, 5) == "success"

    def test_one_rep_missed_is_partial(self):
        assert evaluate_workout_success_legacy(4, 5) == "partial"

    def test_two_reps_missed_is_partial(self):
        assert evaluate_workout_success_legacy(3, 5) == "partial"

    def test_three_reps_missed_is_failure(self):
        assert evaluate_workout_success_legacy(2, 5) == "failure"

    def test_zero_reps_is_failure(self):
        assert evaluate_workout_success_legacy(0, 5) == "failure"

    def test_boundary_exactly_two_missed_is_partial(self):
        # 8 target, 6 actual → 2 missed → partial
        assert evaluate_workout_success_legacy(6, 8) == "partial"

    def test_boundary_three_missed_is_failure(self):
        # 8 target, 5 actual → 3 missed → failure
        assert evaluate_workout_success_legacy(5, 8) == "failure"


# ---------------------------------------------------------------------------
# Pure function: evaluate_rep_range
# ---------------------------------------------------------------------------

class TestEvaluateRepRange:
    def test_at_max_reps_is_success(self):
        assert evaluate_rep_range(12, 8, 12) == "success"

    def test_above_max_reps_is_success(self):
        assert evaluate_rep_range(15, 8, 12) == "success"

    def test_exactly_at_min_is_near_success(self):
        assert evaluate_rep_range(8, 8, 12) == "near_success"

    def test_within_range_is_near_success(self):
        assert evaluate_rep_range(10, 8, 12) == "near_success"

    def test_one_below_min_is_failure(self):
        assert evaluate_rep_range(7, 8, 12) == "failure"

    def test_zero_reps_is_failure(self):
        assert evaluate_rep_range(0, 8, 12) == "failure"

    def test_wide_range_boundaries(self):
        # Range 5-12 (defaults)
        assert evaluate_rep_range(12, 5, 12) == "success"
        assert evaluate_rep_range(5, 5, 12) == "near_success"
        assert evaluate_rep_range(4, 5, 12) == "failure"


# ---------------------------------------------------------------------------
# Pure function: get_user_progression_multiplier
# ---------------------------------------------------------------------------

class TestGetUserProgressionMultiplier:
    def test_beginner_returns_2x(self):
        assert get_user_progression_multiplier("beginner") == 2.0

    def test_intermediate_returns_1x(self):
        assert get_user_progression_multiplier("intermediate") == 1.0

    def test_advanced_returns_0_6x(self):
        assert get_user_progression_multiplier("advanced") == 0.6

    def test_none_returns_1x(self):
        assert get_user_progression_multiplier(None) == 1.0

    def test_unknown_string_returns_1x(self):
        assert get_user_progression_multiplier("expert") == 1.0

    def test_case_insensitive(self):
        assert get_user_progression_multiplier("Beginner") == 2.0
        assert get_user_progression_multiplier("ADVANCED") == 0.6


# ---------------------------------------------------------------------------
# Pure function: calculate_next_weight (default rate = 2.5%)
# ---------------------------------------------------------------------------

class TestCalculateNextWeight:
    def test_success_increases_by_2_5_percent(self):
        # 100 * 1.025 = 102.5
        result = calculate_next_weight(100.0, "success")
        assert result == 102.5

    def test_near_success_maintains_weight(self):
        result = calculate_next_weight(100.0, "near_success")
        assert result == 100.0

    def test_partial_maintains_weight_legacy_alias(self):
        # "partial" is the legacy alias for "near_success"
        result = calculate_next_weight(100.0, "partial")
        assert result == 100.0

    def test_failure_decreases_by_2_5_percent(self):
        # 100 * 0.975 = 97.5
        result = calculate_next_weight(100.0, "failure")
        assert result == 97.5

    def test_result_is_rounded_to_2_decimals(self):
        # 95.0 * 1.025 = 97.375 but floating-point may give 97.3749... → rounds to 97.37
        result = calculate_next_weight(95.0, "success")
        assert result == 97.37

    def test_explicit_5_percent_rate_success(self):
        # With progression_rate=0.05 → +5%
        result = calculate_next_weight(100.0, "success", progression_rate=0.05)
        assert result == 105.0

    def test_explicit_5_percent_rate_failure(self):
        result = calculate_next_weight(100.0, "failure", progression_rate=0.05)
        assert result == 95.0

    def test_beginner_multiplier_doubles_rate(self):
        # rate=2.5%, multiplier=2.0 → effective rate 5% → 105.0
        result = calculate_next_weight(100.0, "success", progression_rate=0.025, user_multiplier=2.0)
        assert result == 105.0

    def test_advanced_multiplier_reduces_rate(self):
        # rate=2.5%, multiplier=0.6 → effective rate 1.5% → 101.5
        result = calculate_next_weight(100.0, "success", progression_rate=0.025, user_multiplier=0.6)
        assert result == 101.5


# ---------------------------------------------------------------------------
# Pure function: detect_plateau
# ---------------------------------------------------------------------------

class TestDetectPlateau:
    def test_three_partials_is_plateau(self):
        assert detect_plateau(["partial", "partial", "partial"]) is True

    def test_three_failures_is_plateau(self):
        assert detect_plateau(["failure", "failure", "failure"]) is True

    def test_three_near_success_is_plateau(self):
        # "near_success" is non-success → should trigger plateau
        assert detect_plateau(["near_success", "near_success", "near_success"]) is True

    def test_mixed_near_success_and_failure_is_plateau(self):
        assert detect_plateau(["near_success", "failure", "near_success"]) is True

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
        # First two are success, last three all near_success → plateau
        assert detect_plateau(["success", "success", "near_success", "near_success", "near_success"]) is True
        # Last one success → no plateau
        assert detect_plateau(["partial", "partial", "partial", "success"]) is False


# ---------------------------------------------------------------------------
# Pure function: detect_bodyweight_escalation
# ---------------------------------------------------------------------------

class TestDetectBodyweightEscalation:
    def test_reps_above_threshold_is_true(self):
        assert detect_bodyweight_escalation(21) is True

    def test_reps_at_threshold_is_false(self):
        # Default threshold is 20; exactly 20 is NOT above it
        assert detect_bodyweight_escalation(20) is False

    def test_reps_below_threshold_is_false(self):
        assert detect_bodyweight_escalation(10) is False

    def test_custom_threshold(self):
        assert detect_bodyweight_escalation(16, threshold=15) is True
        assert detect_bodyweight_escalation(15, threshold=15) is False


# ---------------------------------------------------------------------------
# Integration: analyze_progression
# ---------------------------------------------------------------------------

class TestAnalyzeProgression:
    """
    sample_exercise has no rep_range metadata → defaults: rep_min=5, rep_max=12.
    Outcome mapping:
        reps >= 12 → "success"   → trend "improving"
        5 <= reps < 12 → "near_success" → trend "stable"
        reps < 5  → "failure"  → trend "regressing"
    """

    def test_no_sets_returns_stable_defaults(self, db_session, test_user, sample_exercise):
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["trend"] == "stable"
        assert result["plateau_detected"] is False
        assert result["is_pr"] is False
        assert result["last_outcome"] is None

    def test_success_outcome_gives_improving_trend(self, db_session, test_user, sample_exercise):
        # 12 reps >= max(12) → success
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 12)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["trend"] == "improving"
        assert result["last_outcome"] == "success"

    def test_near_success_outcome_gives_stable_trend(self, db_session, test_user, sample_exercise):
        # 8 reps within [5,12) → near_success
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 8)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["trend"] == "stable"
        assert result["last_outcome"] == "near_success"

    def test_failure_outcome_gives_regressing_trend(self, db_session, test_user, sample_exercise):
        # 3 reps < min(5) → failure
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 3)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["trend"] == "regressing"
        assert result["last_outcome"] == "failure"

    def test_plateau_detected_after_3_near_successes(self, db_session, test_user, sample_exercise):
        # 3 × 8 reps → all near_success → plateau
        create_mock_sets(db_session, test_user.id, sample_exercise.id,
                         [(100, 8), (100, 8), (100, 8)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["plateau_detected"] is True

    def test_pr_detected_on_first_set(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 12)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["is_pr"] is True

    def test_pr_detected_on_new_max(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 12), (110, 12)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["is_pr"] is True

    def test_no_pr_on_same_weight(self, db_session, test_user, sample_exercise):
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 12), (100, 12)])
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert result["is_pr"] is False

    def test_invalid_exercise_raises_404(self, db_session, test_user):
        with pytest.raises(HTTPException) as exc_info:
            analyze_progression(db_session, test_user.id, 999)
        assert exc_info.value.status_code == 404

    def test_result_includes_exercise_type(self, db_session, test_user, sample_exercise):
        result = analyze_progression(db_session, test_user.id, sample_exercise.id)
        assert "exercise_type" in result


# ---------------------------------------------------------------------------
# Integration: generate_recommendation
# ---------------------------------------------------------------------------

class TestGenerateRecommendation:
    """
    sample_exercise defaults: rep_min=5, rep_max=12, progression_rate=2.5%.
    12 reps → success → +2.5% → 102.5
    8 reps  → near_success → maintain
    2 reps  → failure (< min=5) → -2.5% → 97.5
    """

    def test_no_data_returns_zero_weight(self, db_session, test_user, sample_exercise):
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["next_weight"] == 0.0
        assert rec["is_deload"] is False
        assert rec["action"] == "maintain"

    def test_success_increases_weight_by_2_5_percent(self, db_session, test_user, sample_exercise):
        # 12 reps >= max(12) → success → +2.5%
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 12)])
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["action"] == "increase"
        assert rec["is_deload"] is False
        assert rec["next_weight"] == 102.5

    def test_near_success_maintains_weight(self, db_session, test_user, sample_exercise):
        # 8 reps within range → near_success → maintain
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 8)])
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["action"] == "maintain"
        assert rec["next_weight"] == 100.0

    def test_failure_decreases_weight_by_2_5_percent(self, db_session, test_user, sample_exercise):
        # 2 reps < min(5) → failure → -2.5%
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 2)])
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["action"] == "decrease"
        assert rec["is_deload"] is False
        assert rec["next_weight"] == 97.5

    def test_plateau_triggers_deload(self, db_session, test_user, sample_exercise):
        # 3 × near_success → plateau → deload 10%
        create_mock_sets(db_session, test_user.id, sample_exercise.id,
                         [(100, 8), (100, 8), (100, 8)])
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["action"] == "deload"
        assert rec["is_deload"] is True
        assert rec["next_weight"] == 90.0

    def test_result_contains_required_keys(self, db_session, test_user, sample_exercise):
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert {"exercise_id", "action", "next_weight", "target_reps", "reasoning", "is_deload"}.issubset(rec.keys())

    def test_target_reps_is_range_string(self, db_session, test_user, sample_exercise):
        # target_reps is now a "min-max" string, not an int
        rec = generate_recommendation(db_session, test_user.id, sample_exercise.id)
        assert rec["target_reps"] == "5-12"


# ---------------------------------------------------------------------------
# Integration: compute_post_workout_progression — all 4 required cases
# ---------------------------------------------------------------------------

class TestComputePostWorkoutProgression:
    """Tests the orchestrating function that returns action-oriented results.

    compute_post_workout_progression delegates entirely to generate_recommendation.
    Four required cases:
      1. Full success  (reps >= rep_max) → action = "increase"
      2. Near success  (rep_min <= reps < rep_max) → action = "maintain"
      3. Failure       (reps < rep_min) → action = "decrease"
      4. Plateau       (3 non-success sessions) → action = "deload"

    sample_exercise defaults: rep_min=5, rep_max=12.
    """

    def test_full_success_case_action_is_increase(self, db_session, test_user, sample_exercise):
        """reps >= rep_max → increase weight."""
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 12)])
        result = compute_post_workout_progression(db_session, test_user.id, sample_exercise.id)
        assert result["action"] == "increase"
        assert result["next_weight"] == 102.5  # 100 * 1.025
        assert result["exercise_id"] == sample_exercise.id

    def test_near_success_case_action_is_maintain(self, db_session, test_user, sample_exercise):
        """rep_min <= reps < rep_max → maintain weight."""
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 8)])
        result = compute_post_workout_progression(db_session, test_user.id, sample_exercise.id)
        assert result["action"] == "maintain"
        assert result["next_weight"] == 100.0
        assert result["exercise_id"] == sample_exercise.id

    def test_failure_case_action_is_decrease(self, db_session, test_user, sample_exercise):
        """reps < rep_min → decrease weight."""
        create_mock_sets(db_session, test_user.id, sample_exercise.id, [(100, 2)])
        result = compute_post_workout_progression(db_session, test_user.id, sample_exercise.id)
        assert result["action"] == "decrease"
        assert result["next_weight"] == 97.5  # 100 * 0.975
        assert result["exercise_id"] == sample_exercise.id

    def test_plateau_case_action_is_deload(self, db_session, test_user, sample_exercise):
        """3 consecutive near_success → plateau → deload by 10%."""
        create_mock_sets(db_session, test_user.id, sample_exercise.id,
                         [(100, 8), (100, 8), (100, 8)])
        result = compute_post_workout_progression(db_session, test_user.id, sample_exercise.id)
        assert result["action"] == "deload"
        assert result["next_weight"] == 90.0
        assert "deload" in result["reasoning"].lower() or "plateau" in result["reasoning"].lower()
        assert result["exercise_id"] == sample_exercise.id

    def test_no_data_returns_maintain(self, db_session, test_user, sample_exercise):
        """No prior sets → maintain with 0 weight."""
        result = compute_post_workout_progression(db_session, test_user.id, sample_exercise.id)
        assert result["action"] == "maintain"
        assert result["next_weight"] == 0.0

    def test_plateau_detected_mixed_failure_and_near_success(self, db_session, test_user, sample_exercise):
        """Plateau triggered by a mix of near_success and failure outcomes."""
        # near_success(8), failure(2), near_success(8) → all non-success → plateau
        create_mock_sets(db_session, test_user.id, sample_exercise.id,
                         [(100, 8), (100, 2), (100, 8)])
        result = compute_post_workout_progression(db_session, test_user.id, sample_exercise.id)
        assert result["action"] == "deload"

    def test_result_contains_required_keys(self, db_session, test_user, sample_exercise):
        """Response dict always has all required keys."""
        result = compute_post_workout_progression(db_session, test_user.id, sample_exercise.id)
        required_keys = {"exercise_id", "action", "next_weight", "target_reps", "reasoning", "is_deload"}
        assert required_keys.issubset(result.keys())
