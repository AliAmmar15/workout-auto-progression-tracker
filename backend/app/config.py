import os

# Database
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/workout_tracker",
)

# JWT
_default_secret = "dev-secret-key-change-in-production"
SECRET_KEY = os.getenv("SECRET_KEY", _default_secret)
if SECRET_KEY == _default_secret and os.getenv("ENV", "development") == "production":
    raise RuntimeError("SECRET_KEY environment variable must be set in production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
