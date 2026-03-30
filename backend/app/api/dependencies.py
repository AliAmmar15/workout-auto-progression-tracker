from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.user import User
from app.utils.auth import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency to authenticate the user via JWT token."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
        
    return user


def get_optional_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Resolve the user if a valid token exists, otherwise return None."""
    if not token:
        return None

    user_id = decode_access_token(token)
    if user_id is None:
        return None

    return db.query(User).filter(User.id == user_id).first()
