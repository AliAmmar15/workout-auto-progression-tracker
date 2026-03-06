from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# --- Request schemas ---

class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# --- Response schemas ---

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
