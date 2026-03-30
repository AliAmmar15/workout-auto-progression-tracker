from typing import Optional, Union

from pydantic import BaseModel, field_validator


class ProgressionResponse(BaseModel):
    exercise_id: str

    @field_validator("exercise_id", mode="before")
    @classmethod
    def coerce_exercise_id(cls, v):
        return str(v)
    exercise_name: str
    exercise_type: Optional[str] = None
    recent_sets: list[dict]
    trend: str
    plateau_detected: bool
    is_pr: bool
    # last_outcome values: "success" | "near_success" | "failure" | None
    last_outcome: Optional[str] = None


class RecommendationResponse(BaseModel):
    exercise_id: str

    @field_validator("exercise_id", mode="before")
    @classmethod
    def coerce_exercise_id(cls, v):
        return str(v)
    action: str  # "increase" | "maintain" | "decrease" | "deload" | "add_weight"
    next_weight: float
    # target_reps can be int (e.g. 8) or range string (e.g. "8-12")
    target_reps: Union[int, str]
    reasoning: str
    is_deload: bool
