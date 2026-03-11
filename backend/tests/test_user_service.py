import pytest
from fastapi import HTTPException

from app.schemas.user import UserUpdate
from app.services.user_service import get_user_by_id, update_user, delete_user
from app.models.user import User

def test_get_user_by_id_success(db_session, test_user):
    user = get_user_by_id(db_session, test_user.id)
    assert user.id == test_user.id
    assert user.email == test_user.email

def test_get_user_by_id_not_found(db_session):
    with pytest.raises(HTTPException) as exc_info:
        get_user_by_id(db_session, 999)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "User not found"

def test_update_user_success(db_session, test_user):
    update_data = UserUpdate(username="updateduser")
    updated_user = update_user(db_session, test_user.id, update_data)
    
    assert updated_user.username == "updateduser"
    assert updated_user.email == test_user.email
    
    db_user = db_session.query(User).filter(User.id == test_user.id).first()
    assert db_user.username == "updateduser"

def test_update_user_duplicate_email(db_session, test_user):
    # Create another user
    other_user = User(username="other", email="other@example.com", password_hash="hash")
    db_session.add(other_user)
    db_session.commit()
    
    update_data = UserUpdate(email="other@example.com")
    with pytest.raises(HTTPException) as exc_info:
        update_user(db_session, test_user.id, update_data)
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Email already registered"

def test_update_user_duplicate_username(db_session, test_user):
    # Create another user
    other_user = User(username="other", email="other@example.com", password_hash="hash")
    db_session.add(other_user)
    db_session.commit()
    
    update_data = UserUpdate(username="other")
    with pytest.raises(HTTPException) as exc_info:
        update_user(db_session, test_user.id, update_data)
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Username already taken"

def test_delete_user_success(db_session, test_user):
    user_id = test_user.id
    delete_user(db_session, user_id)
    
    db_user = db_session.query(User).filter(User.id == user_id).first()
    assert db_user is None

def test_delete_user_not_found(db_session):
    with pytest.raises(HTTPException) as exc_info:
        delete_user(db_session, 999)
    assert exc_info.value.status_code == 404
    assert "User not found" in exc_info.value.detail
