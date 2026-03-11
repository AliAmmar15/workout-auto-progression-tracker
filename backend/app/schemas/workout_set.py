from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- Request schemas ---

class WorkoutSetCreate(BaseModel):
    exercise_id: int
    set_number: int = Field(..., ge=1)
    weight: float = Field(..., ge=0)
    reps: int = Field(..., ge=1)
    rpe: Optional[int] = Field(None, ge=1, le=10)


class WorkoutSetUpdate(BaseModel):
    weight: Optional[float] = Field(None, ge=0)
    reps: Optional[int] = Field(None, ge=1)
    rpe: Optional[int] = Field(None, ge=1, le=10)


# --- Response schemas ---

from app.schemas.exercise import ExerciseResponse

class WorkoutSetResponse(BaseModel):
    id: int
    workout_id: int
    exercise_id: int
    set_number: int
    weight: float
    reps: int
    rpe: Optional[int]
    created_at: datetime
    exercise: Optional[ExerciseResponse] = None

    model_config = {"from_attributes": True}
