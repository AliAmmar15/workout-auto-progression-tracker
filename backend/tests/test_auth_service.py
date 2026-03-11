import pytest
from fastapi import HTTPException

from app.schemas.user import UserCreate, UserLogin
from app.services.auth_service import register, login
from app.models.user import User

def test_register_success(db_session):
    data = UserCreate(username="newuser", email="newuser@example.com", password="password123")
    user = register(db_session, data)
    
    assert user.id is not None
    assert user.username == "newuser"
    assert user.email == "newuser@example.com"
    assert user.password_hash is not None
    
    # Verify persistence
    db_user = db_session.query(User).filter(User.email == "newuser@example.com").first()
    assert db_user is not None

def test_register_duplicate_email(db_session, test_user):
    data = UserCreate(username="anotheruser", email=test_user.email, password="password123")
    with pytest.raises(HTTPException) as exc_info:
        register(db_session, data)
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Email already registered"

def test_register_duplicate_username(db_session, test_user):
    data = UserCreate(username=test_user.username, email="another@example.com", password="password123")
    with pytest.raises(HTTPException) as exc_info:
        register(db_session, data)
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Username already taken"

def test_login_success(db_session, test_user):
    data = UserLogin(email=test_user.email, password="password123")
    token_response = login(db_session, data)
    
    assert token_response.access_token is not None
    assert token_response.token_type == "bearer"

def test_login_invalid_email(db_session, test_user):
    data = UserLogin(email="wrong@example.com", password="password123")
    with pytest.raises(HTTPException) as exc_info:
        login(db_session, data)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid email or password"

def test_login_invalid_password(db_session, test_user):
    data = UserLogin(email=test_user.email, password="wrongpassword")
    with pytest.raises(HTTPException) as exc_info:
        login(db_session, data)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid email or password"
