from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.user import UserUpdate, UserResponse
from app.services import user_service

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get the authenticated user's profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the authenticated user's profile (username or email)."""
    return user_service.update_user(db, current_user.id, data)


@router.delete("/me", status_code=204)
def delete_current_user_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete the authenticated user's account and all associated data."""
    user_service.delete_user(db, current_user.id)
