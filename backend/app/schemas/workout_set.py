from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# --- Request schemas ---

class WorkoutSetCreate(BaseModel):
    exercise_id: str
    set_number: int = Field(..., ge=1)
    weight: float = Field(..., ge=0, le=2000)
    reps: int = Field(..., ge=1, le=500)
    rpe: Optional[int] = Field(None, ge=1, le=10)

    @field_validator("exercise_id", mode="before")
    @classmethod
    def coerce_exercise_id_to_string(cls, value):
        return str(value)


class WorkoutSetUpdate(BaseModel):
    weight: Optional[float] = Field(None, ge=0)
    reps: Optional[int] = Field(None, ge=1)
    rpe: Optional[int] = Field(None, ge=1, le=10)


# --- Response schemas ---

from app.schemas.exercise import ExerciseResponse

class WorkoutSetResponse(BaseModel):
    id: int
    workout_id: int
    exercise_id: str
    set_number: int
    weight: float
    reps: int
    rpe: Optional[int]
    created_at: datetime
    exercise: Optional[ExerciseResponse] = None

    @field_validator("exercise_id", mode="before")
    @classmethod
    def coerce_response_exercise_id_to_string(cls, value):
        return str(value)

    model_config = {"from_attributes": True}
