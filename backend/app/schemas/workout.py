from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# --- Request schemas ---

class WorkoutCreate(BaseModel):
    date: date
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("date")
    @classmethod
    def validate_date_bounds(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Workout date cannot be in the future")
        if v.year < 2000:
            raise ValueError("Workout date must be after year 2000")
        return v


class WorkoutUpdate(BaseModel):
    date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("date")
    @classmethod
    def validate_date_bounds(cls, v: date | None) -> date | None:
        if v is not None:
            if v > date.today():
                raise ValueError("Workout date cannot be in the future")
            if v.year < 2000:
                raise ValueError("Workout date must be after year 2000")
        return v


# --- Response schemas ---

class WorkoutResponse(BaseModel):
    id: int
    user_id: int
    date: date
    notes: Optional[str]
    created_at: datetime
    sets: list["WorkoutSetResponse"] = []

    model_config = {"from_attributes": True}


class WorkoutDetailResponse(WorkoutResponse):
    """Workout response that includes nested sets."""
    sets: list["WorkoutSetResponse"] = []


# Avoid circular import — resolved at end of module
from app.schemas.workout_set import WorkoutSetResponse  # noqa: E402

WorkoutResponse.model_rebuild()
WorkoutDetailResponse.model_rebuild()
