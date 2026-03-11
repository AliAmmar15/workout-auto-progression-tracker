from typing import List, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.models.exercise import Exercise

def analyze_progression(db: Session, user_id: int, exercise_id: int):
    """
    Analyze recent workout sets to determine progression trend, plateau status, and PRs.
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
            "is_pr": False
        }

    recent_sets = [{"weight": s.weight, "reps": s.reps} for s in sets[-5:]]
    weights = [s["weight"] for s in recent_sets]

    trend = "stable"
    plateau_detected = False

    if len(weights) >= 3:
        if weights[-1] > weights[-2] > weights[-3]:
            trend = "improving"
        elif weights[-1] == weights[-2] == weights[-3]:
            trend = "stagnating"
            plateau_detected = True
        elif weights[-1] < weights[-2]:
            trend = "regressing"

    # PR Logic: Is the current max weight highest ever lifted for this exercise?
    max_ever_lifted = max([s.weight for s in sets])
    latest_weight = sets[-1].weight
    
    is_pr = False
    
    # If the latest weight is the max ever lifted, it's a PR. 
    # But only if it's strictly greater than previous maxes, OR if there's only 1 set ever
    if len(sets) == 1:
        is_pr = True
    else:
        previous_max = max([s.weight for s in sets[:-1]])
        if latest_weight > previous_max:
            is_pr = True

    return {
        "exercise_id": exercise_id,
        "exercise_name": exercise.name,
        "recent_sets": recent_sets,
        "trend": trend,
        "plateau_detected": plateau_detected,
        "is_pr": is_pr
    }

def generate_recommendation(db: Session, user_id: int, exercise_id: int):
    """
    Generate next workout recommendation based on progression analysis.
    """
    analysis = analyze_progression(db, user_id, exercise_id)
    recent = analysis["recent_sets"]
    
    if not recent:
        return {
            "exercise_id": exercise_id,
            "recommended_weight": 0.0,
            "recommended_reps": 0,
            "reasoning": "Not enough data to recommendations.",
            "is_deload": False
        }

    last_weight = recent[-1]["weight"]
    last_reps = recent[-1]["reps"]
    plateau_detected = analysis["plateau_detected"]

    if plateau_detected:
        # Deload logic
        return {
            "exercise_id": exercise_id,
            "recommended_weight": round(last_weight * 0.9, 2),
            "recommended_reps": last_reps,
            "reasoning": "Plateau detected. Reducing weight for recovery.",
            "is_deload": True
        }

    # Progression rule
    if analysis["trend"] == "improving" or analysis["trend"] == "stable":
        return {
            "exercise_id": exercise_id,
            "recommended_weight": last_weight + 5.0,
            "recommended_reps": last_reps,
            "reasoning": "Progressive overload: +5 lbs",
            "is_deload": False
        }
        
    return {
        "exercise_id": exercise_id,
        "recommended_weight": last_weight,
        "recommended_reps": last_reps,
        "reasoning": "Keep working at this weight.",
        "is_deload": False
    }
