from typing import Optional

from pydantic import BaseModel


class ProgressionResponse(BaseModel):
    exercise_id: int
    exercise_name: str
    recent_sets: list[dict]
    trend: str
    plateau_detected: bool
    is_pr: bool


class RecommendationResponse(BaseModel):
    exercise_id: int
    recommended_weight: float
    recommended_reps: int
    reasoning: str
    is_deload: bool
