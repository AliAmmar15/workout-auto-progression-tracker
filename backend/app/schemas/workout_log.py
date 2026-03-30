from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, field_validator

from app.schemas.workout_set import WorkoutSetCreate, WorkoutSetResponse


class WorkoutLogCreate(BaseModel):
    """Schema for logging a complete workout with all sets in a single request.

    This allows the client to submit the entire workout session at once,
    reducing the number of API calls from N+1 (1 workout + N sets) to 1.
    """
    date: date
    notes: Optional[str] = Field(None, max_length=2000)
    sets: list[WorkoutSetCreate] = Field(..., min_length=1, max_length=50)

    @field_validator("date")
    @classmethod
    def validate_date_bounds(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Workout date cannot be in the future")
        if v.year < 2000:
            raise ValueError("Workout date must be after year 2000")
        return v


class WorkoutProgressionItem(BaseModel):
    """Per-exercise progression recommendation returned after a workout is logged."""
    exercise_id: str

    @field_validator("exercise_id", mode="before")
    @classmethod
    def coerce_exercise_id(cls, v):
        return str(v)
    exercise_name: Optional[str] = None
    action: str          # "increase" | "maintain" | "decrease" | "deload" | "add_weight"
    next_weight: float
    target_reps: Optional[str] = None
    reasoning: str
    is_deload: bool = False


class WorkoutLogResponse(BaseModel):
    """Response for the full workout log including nested set details and progression."""
    id: int
    user_id: int
    date: date
    notes: Optional[str]
    sets: list[WorkoutSetResponse]
    progressions: list[WorkoutProgressionItem] = []
    message: str = "Workout logged"

    model_config = {"from_attributes": True}
