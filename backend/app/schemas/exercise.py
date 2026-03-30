from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, computed_field, field_validator

ExerciseType = Literal["compound", "isolation", "bodyweight"]


# --- Request schemas ---

class ExerciseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    muscle_group: str = Field(..., min_length=1, max_length=50)
    equipment: Optional[str] = Field("none", max_length=50)
    exercise_type: Optional[str] = Field(None, max_length=20)
    rep_range_min: Optional[int] = Field(None, ge=1)
    rep_range_max: Optional[int] = Field(None, ge=1)
    progression_rate: Optional[float] = Field(None, ge=0.0, le=1.0)


class ExerciseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    muscle_group: Optional[str] = Field(None, min_length=1, max_length=50)
    equipment: Optional[str] = Field(None, max_length=50)
    exercise_type: Optional[str] = Field(None, max_length=20)
    rep_range_min: Optional[int] = Field(None, ge=1)
    rep_range_max: Optional[int] = Field(None, ge=1)
    progression_rate: Optional[float] = Field(None, ge=0.0, le=1.0)


class CustomExerciseCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    muscle_group: str = Field(..., min_length=1, max_length=50)
    equipment: Literal["barbell", "dumbbell", "machine", "cable", "bodyweight"]


# --- Response schemas ---

class ExerciseResponse(BaseModel):
    id: str
    canonical_name: str
    display_name: str
    muscle_group: str
    equipment: str
    is_custom: bool
    user_id: Optional[int] = None
    exercise_type: Optional[str] = None
    rep_range_min: Optional[int] = None
    rep_range_max: Optional[int] = None
    progression_rate: Optional[float] = None
    created_at: datetime

    @computed_field(return_type=str)
    @property
    def name(self) -> str:
        return self.display_name

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id_to_string(cls, value):
        return str(value)

    model_config = {"from_attributes": True}
