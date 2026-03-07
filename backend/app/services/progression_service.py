from typing import List, Dict


def analyze_progression(exercise_id: int, exercise_name: str, recent_sets: List[Dict]):
    """
    Analyze recent workout sets to determine progression trend and plateau status.
    """

    weights = [s["weight"] for s in recent_sets]

    trend = "stable"
    plateau_detected = False

    if len(weights) >= 3:
        if weights[-1] > weights[-2] > weights[-3]:
            trend = "progressing"

        elif weights[-1] == weights[-2] == weights[-3]:
            trend = "stagnating"
            plateau_detected = True

        elif weights[-1] < weights[-2]:
            trend = "regressing"

    return {
        "exercise_id": exercise_id,
        "exercise_name": exercise_name,
        "recent_sets": recent_sets,
        "trend": trend,
        "plateau_detected": plateau_detected,
    }


def generate_recommendation(
    exercise_id: int,
    last_weight: float,
    last_reps: int,
    plateau_detected: bool
):
    """
    Generate next workout recommendation based on progression analysis.
    """

    if plateau_detected:
        # Deload logic
        return {
            "exercise_id": exercise_id,
            "recommended_weight": round(last_weight * 0.9, 2),
            "recommended_reps": last_reps,
            "reasoning": "Plateau detected. Reducing weight for recovery.",
        }

    # Progression rule
    return {
        "exercise_id": exercise_id,
        "recommended_weight": last_weight + 5,
        "recommended_reps": last_reps,
        "reasoning": "Progressing well. Increasing weight.",
    }
