-- Workout Progress Tracker — Live Database Migration
-- Run this against an existing database to add the new columns from the
-- exercise normalization + progression upgrade (Phase 7/8).
--
-- All statements use ADD COLUMN IF NOT EXISTS so the script is idempotent
-- and safe to re-run without errors.

-- ── exercises table ────────────────────────────────────────────────────────
-- New canonical/custom exercise fields
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(100);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Canonical exercise type (compound | isolation | bodyweight)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type VARCHAR(20);

-- Rep range bounds for the progression engine
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS rep_range_min INTEGER;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS rep_range_max INTEGER;

-- Default rate of weight progression per successful session (e.g. 0.025 = 2.5%)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS progression_rate FLOAT;

-- Backfill for older schemas that only had a `name` column.
UPDATE exercises SET display_name = name WHERE display_name IS NULL;
UPDATE exercises
SET canonical_name = LOWER(REGEXP_REPLACE(COALESCE(display_name, ''), '[^a-zA-Z0-9]+', '_', 'g'))
WHERE canonical_name IS NULL;

-- The legacy `name` column is replaced by `display_name`. Make it nullable
-- so inserts using the new schema don't raise a NOT NULL violation.
ALTER TABLE exercises ALTER COLUMN name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_canonical_name ON exercises(canonical_name);
CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_exercises_canonical_user ON exercises(canonical_name, user_id);

-- ── users table ────────────────────────────────────────────────────────────
-- Physical profile used by the progression engine to adjust rates
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_lbs FLOAT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_inches FLOAT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;

-- beginner | intermediate | advanced
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_level VARCHAR(20);
