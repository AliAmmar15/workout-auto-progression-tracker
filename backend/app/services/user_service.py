from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserUpdate


def get_user_by_id(db: Session, user_id: int) -> User:
    """Return a user by ID or raise 404."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def update_user(db: Session, user_id: int, data: UserUpdate) -> User:
    """Update a user's profile (username and/or email).

    Checks for duplicate email/username on other accounts before applying.
    Raises 409 if the new email or username is taken by another user.
    """
    user = get_user_by_id(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data:
        existing = (
            db.query(User)
            .filter(User.email == update_data["email"], User.id != user_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

    if "username" in update_data:
        existing = (
            db.query(User)
            .filter(User.username == update_data["username"], User.id != user_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> None:
    """Delete a user and all associated data (workouts cascade)."""
    user = get_user_by_id(db, user_id)
    db.delete(user)
    db.commit()
