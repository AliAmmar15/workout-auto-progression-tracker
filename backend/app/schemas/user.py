from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

ExperienceLevel = Literal["beginner", "intermediate", "advanced"]


# --- Request schemas ---

class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    # Physical profile — all optional, backward-compatible
    weight_lbs: Optional[float] = Field(None, gt=0)
    height_inches: Optional[float] = Field(None, gt=0)
    age: Optional[int] = Field(None, ge=13, le=120)
    experience_level: Optional[str] = Field(None, max_length=20)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    weight_lbs: Optional[float] = Field(None, gt=0)
    height_inches: Optional[float] = Field(None, gt=0)
    age: Optional[int] = Field(None, ge=13, le=120)
    experience_level: Optional[str] = Field(None, max_length=20)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# --- Response schemas ---

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    weight_lbs: Optional[float] = None
    height_inches: Optional[float] = None
    age: Optional[int] = None
    experience_level: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
