-- Workout Progress Tracker — Initial Schema
-- Tables: users, exercises, workouts, workout_sets

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    -- Physical profile (all nullable for backward compatibility)
    weight_lbs FLOAT,
    height_inches FLOAT,
    age INTEGER,
    experience_level VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE exercises (
    id VARCHAR(36) PRIMARY KEY,
    canonical_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    muscle_group VARCHAR(50) NOT NULL,
    equipment VARCHAR(50) NOT NULL DEFAULT 'none',
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    -- Canonical metadata (nullable so custom/unknown exercises still work)
    exercise_type VARCHAR(20),
    rep_range_min INTEGER,
    rep_range_max INTEGER,
    progression_rate FLOAT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE workouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE workout_sets (
    id SERIAL PRIMARY KEY,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id VARCHAR(36) NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    set_number INTEGER NOT NULL,
    weight FLOAT NOT NULL,
    reps INTEGER NOT NULL,
    rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX idx_workouts_user_date ON workouts(user_id, date);
CREATE INDEX idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX idx_exercises_canonical_name ON exercises(canonical_name);
CREATE INDEX idx_exercises_user_id ON exercises(user_id);
CREATE UNIQUE INDEX uq_exercises_canonical_user ON exercises(canonical_name, user_id);
