from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- Request schemas ---

class ExerciseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    muscle_group: str = Field(..., min_length=1, max_length=50)
    equipment: Optional[str] = Field("none", max_length=50)


class ExerciseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    muscle_group: Optional[str] = Field(None, min_length=1, max_length=50)
    equipment: Optional[str] = Field(None, max_length=50)


# --- Response schemas ---

class ExerciseResponse(BaseModel):
    id: int
    name: str
    muscle_group: str
    equipment: str
    created_at: datetime

    model_config = {"from_attributes": True}
