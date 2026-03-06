from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.workout_set import WorkoutSetCreate, WorkoutSetResponse


class WorkoutLogCreate(BaseModel):
    """Schema for logging a complete workout with all sets in a single request.

    This allows the client to submit the entire workout session at once,
    reducing the number of API calls from N+1 (1 workout + N sets) to 1.
    """
    date: date
    notes: Optional[str] = None
    sets: list[WorkoutSetCreate] = Field(..., min_length=1)


class WorkoutLogResponse(BaseModel):
    """Response for the full workout log including nested set details."""
    id: int
    user_id: int
    date: date
    notes: Optional[str]
    sets: list[WorkoutSetResponse]

    model_config = {"from_attributes": True}
