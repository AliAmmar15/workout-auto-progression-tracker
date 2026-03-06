from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- Request schemas ---

class WorkoutCreate(BaseModel):
    date: date
    notes: Optional[str] = None


class WorkoutUpdate(BaseModel):
    date: Optional[date] = None
    notes: Optional[str] = None


# --- Response schemas ---

class WorkoutResponse(BaseModel):
    id: int
    user_id: int
    date: date
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkoutDetailResponse(WorkoutResponse):
    """Workout response that includes nested sets."""
    sets: list["WorkoutSetResponse"] = []


# Avoid circular import — resolved at end of module
from app.schemas.workout_set import WorkoutSetResponse  # noqa: E402

WorkoutDetailResponse.model_rebuild()
