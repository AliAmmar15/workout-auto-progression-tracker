from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, TokenResponse
from app.utils.auth import hash_password, verify_password, create_access_token


def register(db: Session, data: UserCreate) -> User:
    """Register a new user.

    Checks for duplicate email and username before creating the account.
    Password is hashed with bcrypt before storage.
    Raises 409 if email or username already exists.
    """
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(db: Session, data: UserLogin) -> TokenResponse:
    """Authenticate a user and return a JWT access token.

    Looks up the user by email and verifies the password against the
    stored bcrypt hash. Returns a TokenResponse containing the JWT.
    Raises 401 if credentials are invalid.
    """
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)
