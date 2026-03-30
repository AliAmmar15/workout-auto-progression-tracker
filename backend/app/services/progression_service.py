from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.models.exercise import Exercise


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Rep threshold above which bodyweight exercises should suggest adding weight
_BODYWEIGHT_HIGH_REP_THRESHOLD = 20

# Default rep range for exercises that have no metadata
_DEFAULT_REP_MIN = 5
_DEFAULT_REP_MAX = 12
_DEFAULT_PROGRESSION_RATE = 0.025


# ---------------------------------------------------------------------------
# Pure functions — no DB access, fully deterministic, independently testable
# ---------------------------------------------------------------------------

def evaluate_workout_success_legacy(actual_reps: int, target_reps: int) -> str:
    """
    Legacy single-target evaluation (kept for backward compatibility with
    existing tests).  Compares actual reps to a fixed target.

    Returns:
        'success'  – all target reps met (0 missed)
        'partial'  – small failure: ≤2 reps missed
        'failure'  – large failure: >2 reps missed
    """
    missed = max(0, target_reps - actual_reps)
    if missed == 0:
        return "success"
    elif missed <= 2:
        return "partial"
    else:
        return "failure"


def evaluate_rep_range(actual_reps: int, rep_min: int, rep_max: int) -> str:
    """
    Evaluate reps against a target range.

    Returns:
        'success'      – actual >= rep_max  (hit the top of the range)
        'near_success' – rep_min <= actual < rep_max  (within range, not max)
        'failure'      – actual < rep_min  (below the bottom of the range)
    """
    if actual_reps >= rep_max:
        return "success"
    elif actual_reps >= rep_min:
        return "near_success"
    else:
        return "failure"


def get_user_progression_multiplier(experience_level: Optional[str]) -> float:
    """
    Return a multiplier applied to the progression rate based on experience.

    Beginners progress faster; advanced lifters progress slower.
        beginner     → 2.0x
        intermediate → 1.0x
        advanced     → 0.6x
        None/unknown → 1.0x (safe default)
    """
    multipliers = {
        "beginner": 2.0,
        "intermediate": 1.0,
        "advanced": 0.6,
    }
    return multipliers.get((experience_level or "").lower(), 1.0)


def calculate_next_weight(
    current_weight: float,
    outcome: str,
    progression_rate: float = _DEFAULT_PROGRESSION_RATE,
    user_multiplier: float = 1.0,
) -> float:
    """
    Determine next session's target weight based on outcome.

    Rules:
        success      → +rate * multiplier  (e.g. +2.5% default)
        near_success → maintain (0% change)
        failure      → -rate * multiplier
        partial      → maintain (legacy alias for near_success)

    Returns the new weight rounded to 2 decimal places.
    """
    effective_rate = progression_rate * user_multiplier
    if outcome == "success":
        return round(current_weight * (1 + effective_rate), 2)
    elif outcome in ("failure",):
        return round(current_weight * (1 - effective_rate), 2)
    else:  # "near_success" or legacy "partial"
        return round(current_weight, 2)


def detect_plateau(session_outcomes: List[str]) -> bool:
    """
    Detect a plateau: last 3 consecutive outcomes are all non-success.
    Non-success includes 'partial', 'near_success', and 'failure'.

    Returns True if a plateau is detected, False otherwise.
    """
    if len(session_outcomes) < 3:
        return False
    last_three = session_outcomes[-3:]
    return all(o != "success" for o in last_three)


def detect_bodyweight_escalation(
    reps: int,
    threshold: int = _BODYWEIGHT_HIGH_REP_THRESHOLD,
) -> bool:
    """
    Return True if reps exceed the bodyweight escalation threshold.
    When True, the system should suggest adding external weight.
    """
    return reps > threshold


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_rep_range(exercise: Exercise):
    """Return (rep_min, rep_max) from exercise metadata or defaults."""
    rep_min = exercise.rep_range_min if exercise.rep_range_min is not None else _DEFAULT_REP_MIN
    rep_max = exercise.rep_range_max if exercise.rep_range_max is not None else _DEFAULT_REP_MAX
    return rep_min, rep_max


def _build_target_reps_str(rep_min: int, rep_max: int) -> str:
    """Return a display string like '8-12' for the target rep range."""
    return f"{rep_min}-{rep_max}"


# ---------------------------------------------------------------------------
# Orchestration functions — use pure functions above + DB access
# ---------------------------------------------------------------------------

def analyze_progression(db: Session, user_id: int, exercise_id: UUID | str):
    """
    Analyze recent workout sets to determine progression.

    Uses evaluate_rep_range() against the exercise's rep_range from DB
    (falls back to defaults if the exercise has no metadata).
    Plateau is detected via detect_plateau() across the last 3 session outcomes.
    """
    exercise_id = int(exercise_id)
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    sets = (
        db.query(WorkoutSet)
        .join(Workout)
        .filter(Workout.user_id == user_id, WorkoutSet.exercise_id == exercise_id)
        .order_by(Workout.date.asc(), WorkoutSet.set_number.asc())
        .all()
    )

    if not sets:
        return {
            "exercise_id": exercise_id,
            "exercise_name": exercise.display_name,
            "exercise_type": exercise.exercise_type,
            "recent_sets": [],
            "trend": "stable",
            "plateau_detected": False,
            "is_pr": False,
            "last_outcome": None,
        }

    rep_min, rep_max = _get_rep_range(exercise)
    recent_sets = [{"weight": s.weight, "reps": s.reps} for s in sets[-5:]]

    outcomes = [
        evaluate_rep_range(s["reps"], rep_min, rep_max)
        for s in recent_sets
    ]

    last_outcome = outcomes[-1] if outcomes else None
    if last_outcome == "success":
        trend = "improving"
    elif last_outcome == "near_success":
        trend = "stable"
    else:
        trend = "regressing"

    plateau_detected = detect_plateau(outcomes)

    is_pr = False
    if len(sets) == 1:
        is_pr = True
    else:
        previous_max = max(s.weight for s in sets[:-1])
        if sets[-1].weight > previous_max:
            is_pr = True

    return {
        "exercise_id": exercise_id,
        "exercise_name": exercise.display_name,
        "exercise_type": exercise.exercise_type,
        "recent_sets": recent_sets,
        "trend": trend,
        "plateau_detected": plateau_detected,
        "is_pr": is_pr,
        "last_outcome": last_outcome,
    }


def generate_recommendation(
    db: Session,
    user_id: int,
    exercise_id: UUID | str,
    user_experience: Optional[str] = None,
) -> dict:
    """
    Generate an action-oriented recommendation for the next workout.

    Logic (in priority order):
      1. Bodweight escalation (reps > 20) → action='add_weight'
      2. Plateau (3 non-success) → action='deload' (-10%)
      3. success → action='increase' (use progression_rate + user multiplier)
      4. near_success → action='maintain'
      5. failure → action='decrease'

    Returns:
        {
            "exercise_id":   int,
            "action":        str,
            "next_weight":   float,
            "target_reps":   int | str,
            "reasoning":     str,
            "is_deload":     bool,
        }
    """
    exercise_id = int(exercise_id)
    analysis = analyze_progression(db, user_id, exercise_id)
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    rep_min, rep_max = _get_rep_range(exercise)
    target_reps_str = _build_target_reps_str(rep_min, rep_max)
    progression_rate = (
        exercise.progression_rate
        if exercise.progression_rate is not None
        else _DEFAULT_PROGRESSION_RATE
    )
    user_multiplier = get_user_progression_multiplier(user_experience)
    recent = analysis["recent_sets"]

    if not recent:
        return {
            "exercise_id": exercise_id,
            "action": "maintain",
            "next_weight": 0.0,
            "target_reps": target_reps_str,
            "reasoning": "No previous data. Start with a comfortable weight.",
            "is_deload": False,
        }

    last_weight = recent[-1]["weight"]
    last_reps = recent[-1]["reps"]
    last_outcome = analysis["last_outcome"]
    plateau_detected = analysis["plateau_detected"]
    is_bodyweight = exercise.exercise_type == "bodyweight"

    # 1. Bodyweight escalation: reps are too high → suggest adding weight
    if is_bodyweight and detect_bodyweight_escalation(last_reps):
        return {
            "exercise_id": exercise_id,
            "action": "add_weight",
            "next_weight": last_weight,
            "target_reps": target_reps_str,
            "reasoning": (
                f"Reps ({last_reps}) exceed {_BODYWEIGHT_HIGH_REP_THRESHOLD}. "
                f"Add external weight and target {target_reps_str} reps."
            ),
            "is_deload": False,
        }

    # 2. Plateau → deload
    if plateau_detected:
        next_weight = round(last_weight * 0.9, 2)
        return {
            "exercise_id": exercise_id,
            "action": "deload",
            "next_weight": next_weight,
            "target_reps": target_reps_str,
            "reasoning": (
                f"Plateau detected across 3 sessions. Deload to {next_weight} lbs "
                f"and target {target_reps_str} reps for recovery."
            ),
            "is_deload": True,
        }

    # 3-5. Normal progression
    next_weight = calculate_next_weight(
        last_weight, last_outcome, progression_rate, user_multiplier
    )

    action_map = {
        "success": "increase",
        "near_success": "maintain",
        "failure": "decrease",
    }
    reasoning_map = {
        "success": (
            f"Hit max rep target ({rep_max}+). "
            f"Increase to {next_weight} lbs and target {target_reps_str} reps."
        ),
        "near_success": (
            f"Within rep range ({rep_min}-{rep_max}). "
            f"Maintain {next_weight} lbs and aim for {rep_max} reps."
        ),
        "failure": (
            f"Below rep range (hit {last_reps}, min is {rep_min}). "
            f"Reduce to {next_weight} lbs and target {target_reps_str} reps."
        ),
    }

    return {
        "exercise_id": exercise_id,
        "action": action_map.get(last_outcome, "maintain"),
        "next_weight": next_weight,
        "target_reps": target_reps_str,
        "reasoning": reasoning_map.get(
            last_outcome, f"Maintain {next_weight} lbs."
        ),
        "is_deload": False,
    }


def compute_post_workout_progression(
    db: Session,
    user_id: int,
    exercise_id: UUID | str,
    user_experience: Optional[str] = None,
) -> dict:
    """
    Compute an action-oriented progression result for the post-workout API response.

    Delegates entirely to generate_recommendation() — no logic duplication.
    Returns a flat dict suitable for serialisation.
    """
    return generate_recommendation(db, user_id, str(exercise_id), user_experience)
