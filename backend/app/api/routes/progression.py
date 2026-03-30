from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.progression import ProgressionResponse, RecommendationResponse
from app.services import progression_service

router = APIRouter()


@router.get("/{exercise_id}/progression", response_model=ProgressionResponse)
def get_progression(
    exercise_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get progression insights for an exercise based on user's recent sets."""
    return progression_service.analyze_progression(db, current_user.id, int(exercise_id))


@router.get("/{exercise_id}/recommendation", response_model=RecommendationResponse)
def get_recommendation(
    exercise_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get recommendation for the next target weight/reps.

    Uses the user's experience_level (from their profile) to adjust the
    progression rate.  Beginners progress faster; advanced lifters slower.
    """
    return progression_service.generate_recommendation(
        db,
        current_user.id,
        int(exercise_id),
        user_experience=current_user.experience_level,
    )

