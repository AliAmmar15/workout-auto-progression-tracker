from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.services import auth_service

router = APIRouter()


@router.post("/register", status_code=201, response_model=UserResponse)
def register(data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account.

    Validates that the email and username are not already taken.
    Returns the created user profile (without password hash).
    """
    return auth_service.register(db, data)


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """Authenticate with email and password, receive a JWT access token.

    The returned token should be included in subsequent requests as:
    Authorization: Bearer <token>
    """
    return auth_service.login(db, data)
