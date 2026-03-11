from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, users, exercises, workouts, workout_sets, progression

app = FastAPI(
    title="Workout Progress Tracker",
    description="Track workouts, log sets, and get auto-progression recommendations",
    version="1.0.0",
)

# CORS — allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules under /api/v1
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(exercises.router, prefix="/api/v1/exercises", tags=["Exercises"])
app.include_router(workouts.router, prefix="/api/v1/workouts", tags=["Workouts"])
app.include_router(workout_sets.router, prefix="/api/v1/workouts", tags=["Workout Sets"])
app.include_router(progression.router, prefix="/api/v1/exercises", tags=["Progression"])


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
