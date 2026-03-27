from typing import List
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.models.exercise import Exercise


# ---------------------------------------------------------------------------
# Pure functions — no DB access, fully deterministic, independently testable
# ---------------------------------------------------------------------------

def evaluate_workout_success(actual_reps: int, target_reps: int) -> str:
    """
    Compare actual reps performed to target reps.

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


def calculate_next_weight(current_weight: float, outcome: str) -> float:
    """
    Determine next session's target weight based on the workout outcome.

    Rules (spec-compliant):
        success  → +5%   (within the 2.5–5% range; 5% is standard)
        partial  → maintain (0% change)
        failure  → −5%

    Returns the new weight rounded to 2 decimal places.
    """
    if outcome == "success":
        return round(current_weight * 1.05, 2)
    elif outcome == "failure":
        return round(current_weight * 0.95, 2)
    else:  # partial
        return round(current_weight, 2)


def detect_plateau(session_outcomes: List[str]) -> bool:
    """
    Detect a plateau: last 3 consecutive outcomes are all non-success
    (i.e., 'partial' or 'failure'), indicating the lifter is stuck.

    Returns True if a plateau is detected, False otherwise.
    """
    if len(session_outcomes) < 3:
        return False
    last_three = session_outcomes[-3:]
    return all(o in ("partial", "failure") for o in last_three)


# ---------------------------------------------------------------------------
# Orchestration functions — use pure functions above + DB access
# ---------------------------------------------------------------------------

def analyze_progression(db: Session, user_id: int, exercise_id: int, target_reps: int = 5):
    """
    Analyze recent workout sets to determine progression using reps-based outcome evaluation.

    Each set is evaluated against target_reps via evaluate_workout_success().
    Plateau is detected via detect_plateau() across the last 3 session outcomes.
    """
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
            "exercise_name": exercise.name,
            "recent_sets": [],
            "trend": "stable",
            "plateau_detected": False,
            "is_pr": False,
            "last_outcome": None,
        }

    recent_sets = [{"weight": s.weight, "reps": s.reps} for s in sets[-5:]]

    # Evaluate outcome for each recent set using the pure function
    outcomes = [
        evaluate_workout_success(s["reps"], target_reps)
        for s in recent_sets
    ]

    # Derive human-readable trend from outcomes
    last_outcome = outcomes[-1] if outcomes else None
    if last_outcome == "success":
        trend = "improving"
    elif last_outcome == "partial":
        trend = "stable"
    else:
        trend = "regressing"

    # Detect plateau using the pure function
    plateau_detected = detect_plateau(outcomes)

    # PR detection: latest weight strictly greater than all previous
    is_pr = False
    if len(sets) == 1:
        is_pr = True
    else:
        previous_max = max(s.weight for s in sets[:-1])
        if sets[-1].weight > previous_max:
            is_pr = True

    return {
        "exercise_id": exercise_id,
        "exercise_name": exercise.name,
        "recent_sets": recent_sets,
        "trend": trend,
        "plateau_detected": plateau_detected,
        "is_pr": is_pr,
        "last_outcome": last_outcome,
    }


def compute_post_workout_progression(db: Session, user_id: int, exercise_id: int, target_reps: int = 5) -> dict:
    """
    Compute an action-oriented progression result for the post-workout API response.

    Called immediately after a workout is saved so the newly committed sets are
    included in the analysis.  Returns a flat dict suitable for serialisation:

        {
            "exercise_id":   int,
            "exercise_name": str,
            "action":        "increase" | "maintain" | "decrease" | "deload",
            "next_weight":   float,
            "reasoning":     str,
        }

    Reuses existing pure functions (calculate_next_weight, detect_plateau) and
    the DB orchestrator (analyze_progression) — no logic is duplicated.
    """
    analysis = analyze_progression(db, user_id, exercise_id, target_reps)
    recent = analysis["recent_sets"]

    if not recent:
        return {
            "exercise_id": exercise_id,
            "exercise_name": analysis["exercise_name"],
            "action": "maintain",
            "next_weight": 0.0,
            "reasoning": "No previous data. Start with a comfortable weight.",
        }

    last_weight = recent[-1]["weight"]
    plateau_detected = analysis["plateau_detected"]
    last_outcome = analysis["last_outcome"]

    # Plateau takes priority → deload (−10%)
    if plateau_detected:
        next_weight = round(last_weight * 0.9, 2)
        return {
            "exercise_id": exercise_id,
            "exercise_name": analysis["exercise_name"],
            "action": "deload",
            "next_weight": next_weight,
            "reasoning": f"Plateau detected across 3 sessions. Deload to {next_weight} lbs for recovery.",
        }

    next_weight = calculate_next_weight(last_weight, last_outcome)

    action_map = {
        "success": "increase",
        "partial": "maintain",
        "failure": "decrease",
    }
    reasoning_map = {
        "success": f"All target reps met. Increase to {next_weight} lbs next session.",
        "partial": f"≤2 reps missed. Maintain {next_weight} lbs next session.",
        "failure": f">2 reps missed. Reduce to {next_weight} lbs next session.",
    }

    return {
        "exercise_id": exercise_id,
        "exercise_name": analysis["exercise_name"],
        "action": action_map.get(last_outcome, "maintain"),
        "next_weight": next_weight,
        "reasoning": reasoning_map.get(last_outcome, f"Maintain {next_weight} lbs."),
    }


def generate_recommendation(db: Session, user_id: int, exercise_id: int, target_reps: int = 5):
    """
    Generate next workout recommendation using spec-compliant pure functions.

    Deload path  : plateau detected → −10% (recovery week)
    Normal path  : delegates to calculate_next_weight() with the latest outcome
    """
    analysis = analyze_progression(db, user_id, exercise_id, target_reps)
    recent = analysis["recent_sets"]

    if not recent:
        return {
            "exercise_id": exercise_id,
            "recommended_weight": 0.0,
            "recommended_reps": target_reps,
            "reasoning": "No data yet. Start with a comfortable weight.",
            "is_deload": False,
        }

    last_weight = recent[-1]["weight"]
    last_outcome = analysis["last_outcome"]
    plateau_detected = analysis["plateau_detected"]

    # Plateau → deload (−10%) takes priority over normal progression
    if plateau_detected:
        return {
            "exercise_id": exercise_id,
            "recommended_weight": round(last_weight * 0.9, 2),
            "recommended_reps": target_reps,
            "reasoning": "Plateau detected across 3 sessions. Deloading by 10% for recovery.",
            "is_deload": True,
        }

    # Normal progression: use calculate_next_weight() pure function
    next_weight = calculate_next_weight(last_weight, last_outcome)
    reasoning_map = {
        "success": f"All target reps met. Increasing weight by 5% ({last_weight} → {next_weight}).",
        "partial": f"≤2 reps missed. Maintaining weight at {next_weight}.",
        "failure": f">2 reps missed. Reducing weight by 5% ({last_weight} → {next_weight}).",
    }

    return {
        "exercise_id": exercise_id,
        "recommended_weight": next_weight,
        "recommended_reps": target_reps,
        "reasoning": reasoning_map.get(last_outcome, "Maintain current weight."),
        "is_deload": False,
    }
