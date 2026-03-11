from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.user import User
from app.utils.auth import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency that bypasses auth and returns a demo user.
    """
    user = db.query(User).filter(User.id == 1).first()
    if user is None:
        # Create a demo user if it doesn't exist
        user = User(username="DemoUser", email="demo@example.com", password_hash="disabled")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
