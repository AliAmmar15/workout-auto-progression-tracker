-- Workout Progress Tracker — Live Database Migration
-- Run this against an existing database to add the new columns from the
-- exercise normalization + progression upgrade (Phase 7/8).
--
-- All statements use ADD COLUMN IF NOT EXISTS so the script is idempotent
-- and safe to re-run without errors.

-- ── exercises table ────────────────────────────────────────────────────────
-- Canonical exercise type (compound | isolation | bodyweight)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type VARCHAR(20);

-- Rep range bounds for the progression engine
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS rep_range_min INTEGER;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS rep_range_max INTEGER;

-- Default rate of weight progression per successful session (e.g. 0.025 = 2.5%)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS progression_rate FLOAT;

-- ── users table ────────────────────────────────────────────────────────────
-- Physical profile used by the progression engine to adjust rates
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_lbs FLOAT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_inches FLOAT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;

-- beginner | intermediate | advanced
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_level VARCHAR(20);
