import httpx
import asyncio

async def seed_exercises():
    exercises = [
        # ── Chest ──────────────────────────────────────────────────────────
        {"name": "Barbell Bench Press",         "muscle_group": "Chest",     "equipment": "Barbell"},
        {"name": "Incline Barbell Bench Press",  "muscle_group": "Chest",     "equipment": "Barbell"},
        {"name": "Decline Barbell Bench Press",  "muscle_group": "Chest",     "equipment": "Barbell"},
        {"name": "Dumbbell Bench Press",         "muscle_group": "Chest",     "equipment": "Dumbbell"},
        {"name": "Incline Dumbbell Bench Press", "muscle_group": "Chest",     "equipment": "Dumbbell"},
        {"name": "Decline Dumbbell Bench Press", "muscle_group": "Chest",     "equipment": "Dumbbell"},
        {"name": "Dumbbell Fly",                 "muscle_group": "Chest",     "equipment": "Dumbbell"},
        {"name": "Incline Dumbbell Fly",         "muscle_group": "Chest",     "equipment": "Dumbbell"},
        {"name": "Cable Chest Fly",              "muscle_group": "Chest",     "equipment": "Cable"},
        {"name": "Pec Deck",                     "muscle_group": "Chest",     "equipment": "Machine"},
        {"name": "Push Up",                      "muscle_group": "Chest",     "equipment": "Bodyweight"},
        {"name": "Chest Dip",                    "muscle_group": "Chest",     "equipment": "Bodyweight"},
        {"name": "Close-Grip Bench Press",       "muscle_group": "Chest",     "equipment": "Barbell"},
        {"name": "Smith Machine Bench Press",    "muscle_group": "Chest",     "equipment": "Machine"},

        # ── Back ───────────────────────────────────────────────────────────
        {"name": "Deadlift",                     "muscle_group": "Back",      "equipment": "Barbell"},
        {"name": "Barbell Row",                  "muscle_group": "Back",      "equipment": "Barbell"},
        {"name": "Pendlay Row",                  "muscle_group": "Back",      "equipment": "Barbell"},
        {"name": "T-Bar Row",                    "muscle_group": "Back",      "equipment": "Barbell"},
        {"name": "Dumbbell Row",                 "muscle_group": "Back",      "equipment": "Dumbbell"},
        {"name": "Seated Cable Row",             "muscle_group": "Back",      "equipment": "Cable"},
        {"name": "Lat Pulldown",                 "muscle_group": "Back",      "equipment": "Cable"},
        {"name": "Straight-Arm Pulldown",        "muscle_group": "Back",      "equipment": "Cable"},
        {"name": "Face Pull",                    "muscle_group": "Back",      "equipment": "Cable"},
        {"name": "Pull Up",                      "muscle_group": "Back",      "equipment": "Bodyweight"},
        {"name": "Chin Up",                      "muscle_group": "Back",      "equipment": "Bodyweight"},
        {"name": "Neutral Grip Pull Up",         "muscle_group": "Back",      "equipment": "Bodyweight"},
        {"name": "Hyperextension",               "muscle_group": "Back",      "equipment": "Machine"},
        {"name": "Good Morning",                 "muscle_group": "Back",      "equipment": "Barbell"},
        {"name": "Rack Pull",                    "muscle_group": "Back",      "equipment": "Barbell"},

        # ── Legs ───────────────────────────────────────────────────────────
        {"name": "Barbell Squat",                "muscle_group": "Legs",      "equipment": "Barbell"},
        {"name": "Front Squat",                  "muscle_group": "Legs",      "equipment": "Barbell"},
        {"name": "Hack Squat",                   "muscle_group": "Legs",      "equipment": "Machine"},
        {"name": "Leg Press",                    "muscle_group": "Legs",      "equipment": "Machine"},
        {"name": "Romanian Deadlift",            "muscle_group": "Legs",      "equipment": "Barbell"},
        {"name": "Stiff-Leg Deadlift",           "muscle_group": "Legs",      "equipment": "Barbell"},
        {"name": "Bulgarian Split Squat",        "muscle_group": "Legs",      "equipment": "Dumbbell"},
        {"name": "Walking Lunge",                "muscle_group": "Legs",      "equipment": "Dumbbell"},
        {"name": "Goblet Squat",                 "muscle_group": "Legs",      "equipment": "Dumbbell"},
        {"name": "Leg Extension",                "muscle_group": "Legs",      "equipment": "Machine"},
        {"name": "Leg Curl",                     "muscle_group": "Legs",      "equipment": "Machine"},
        {"name": "Standing Calf Raise",          "muscle_group": "Legs",      "equipment": "Machine"},
        {"name": "Seated Calf Raise",            "muscle_group": "Legs",      "equipment": "Machine"},
        {"name": "Hip Thrust",                   "muscle_group": "Legs",      "equipment": "Barbell"},
        {"name": "Sumo Deadlift",                "muscle_group": "Legs",      "equipment": "Barbell"},
        {"name": "Step Up",                      "muscle_group": "Legs",      "equipment": "Dumbbell"},

        # ── Shoulders ──────────────────────────────────────────────────────
        {"name": "Overhead Press",               "muscle_group": "Shoulders", "equipment": "Barbell"},
        {"name": "Seated Dumbbell Press",        "muscle_group": "Shoulders", "equipment": "Dumbbell"},
        {"name": "Arnold Press",                 "muscle_group": "Shoulders", "equipment": "Dumbbell"},
        {"name": "Lateral Raise",                "muscle_group": "Shoulders", "equipment": "Dumbbell"},
        {"name": "Cable Lateral Raise",          "muscle_group": "Shoulders", "equipment": "Cable"},
        {"name": "Front Raise",                  "muscle_group": "Shoulders", "equipment": "Dumbbell"},
        {"name": "Rear Delt Fly",                "muscle_group": "Shoulders", "equipment": "Dumbbell"},
        {"name": "Upright Row",                  "muscle_group": "Shoulders", "equipment": "Barbell"},
        {"name": "Barbell Shrug",                "muscle_group": "Shoulders", "equipment": "Barbell"},
        {"name": "Dumbbell Shrug",               "muscle_group": "Shoulders", "equipment": "Dumbbell"},
        {"name": "Machine Shoulder Press",       "muscle_group": "Shoulders", "equipment": "Machine"},

        # ── Biceps ─────────────────────────────────────────────────────────
        {"name": "Barbell Curl",                 "muscle_group": "Biceps",    "equipment": "Barbell"},
        {"name": "Dumbbell Curl",                "muscle_group": "Biceps",    "equipment": "Dumbbell"},
        {"name": "Hammer Curl",                  "muscle_group": "Biceps",    "equipment": "Dumbbell"},
        {"name": "Incline Dumbbell Curl",        "muscle_group": "Biceps",    "equipment": "Dumbbell"},
        {"name": "Preacher Curl",                "muscle_group": "Biceps",    "equipment": "Barbell"},
        {"name": "Cable Curl",                   "muscle_group": "Biceps",    "equipment": "Cable"},
        {"name": "Concentration Curl",           "muscle_group": "Biceps",    "equipment": "Dumbbell"},
        {"name": "Spider Curl",                  "muscle_group": "Biceps",    "equipment": "Dumbbell"},
        {"name": "EZ-Bar Curl",                  "muscle_group": "Biceps",    "equipment": "Barbell"},

        # ── Triceps ────────────────────────────────────────────────────────
        {"name": "Triceps Pushdown",             "muscle_group": "Triceps",   "equipment": "Cable"},
        {"name": "Skull Crusher",                "muscle_group": "Triceps",   "equipment": "Barbell"},
        {"name": "Overhead Triceps Extension",   "muscle_group": "Triceps",   "equipment": "Dumbbell"},
        {"name": "Triceps Dip",                  "muscle_group": "Triceps",   "equipment": "Bodyweight"},
        {"name": "Diamond Push Up",              "muscle_group": "Triceps",   "equipment": "Bodyweight"},
        {"name": "Cable Overhead Extension",     "muscle_group": "Triceps",   "equipment": "Cable"},
        {"name": "Kickback",                     "muscle_group": "Triceps",   "equipment": "Dumbbell"},
        {"name": "Close-Grip Pushdown",          "muscle_group": "Triceps",   "equipment": "Cable"},

        # ── Core ───────────────────────────────────────────────────────────
        {"name": "Plank",                        "muscle_group": "Core",      "equipment": "Bodyweight"},
        {"name": "Side Plank",                   "muscle_group": "Core",      "equipment": "Bodyweight"},
        {"name": "Crunch",                       "muscle_group": "Core",      "equipment": "Bodyweight"},
        {"name": "Decline Crunch",               "muscle_group": "Core",      "equipment": "Bodyweight"},
        {"name": "Hanging Leg Raise",            "muscle_group": "Core",      "equipment": "Bodyweight"},
        {"name": "Cable Crunch",                 "muscle_group": "Core",      "equipment": "Cable"},
        {"name": "Ab Rollout",                   "muscle_group": "Core",      "equipment": "Other"},
        {"name": "Russian Twist",                "muscle_group": "Core",      "equipment": "Bodyweight"},
        {"name": "Mountain Climber",             "muscle_group": "Core",      "equipment": "Bodyweight"},
        {"name": "Bicycle Crunch",               "muscle_group": "Core",      "equipment": "Bodyweight"},
        {"name": "Dragon Flag",                  "muscle_group": "Core",      "equipment": "Bodyweight"},

        # ── Full Body ──────────────────────────────────────────────────────
        {"name": "Power Clean",                  "muscle_group": "Full Body", "equipment": "Barbell"},
        {"name": "Barbell Clean",                "muscle_group": "Full Body", "equipment": "Barbell"},
        {"name": "Thruster",                     "muscle_group": "Full Body", "equipment": "Barbell"},
        {"name": "Kettlebell Swing",             "muscle_group": "Full Body", "equipment": "Other"},
        {"name": "Turkish Get Up",               "muscle_group": "Full Body", "equipment": "Other"},
        {"name": "Burpee",                       "muscle_group": "Full Body", "equipment": "Bodyweight"},
        {"name": "Clean and Press",              "muscle_group": "Full Body", "equipment": "Barbell"},

        # ── Cardio ─────────────────────────────────────────────────────────
        {"name": "Treadmill Run",                "muscle_group": "Cardio",    "equipment": "Machine"},
        {"name": "Stationary Bike",              "muscle_group": "Cardio",    "equipment": "Machine"},
        {"name": "Rowing Machine",               "muscle_group": "Cardio",    "equipment": "Machine"},
        {"name": "Stair Climber",                "muscle_group": "Cardio",    "equipment": "Machine"},
        {"name": "Elliptical",                   "muscle_group": "Cardio",    "equipment": "Machine"},
        {"name": "Jump Rope",                    "muscle_group": "Cardio",    "equipment": "Other"},
        {"name": "Assault Bike",                 "muscle_group": "Cardio",    "equipment": "Machine"},
    ]

    async with httpx.AsyncClient() as client:
        added = 0
        skipped = 0
        for ex in exercises:
            response = await client.post("http://localhost:8000/api/v1/exercises", json=ex)
            if response.status_code == 201:
                print(f"✅ Added:   {ex['name']}")
                added += 1
            elif response.status_code == 409:
                print(f"⏭  Exists:  {ex['name']}")
                skipped += 1
            else:
                print(f"❌ Failed:  {ex['name']} — {response.text}")
        print(f"\nDone. {added} added, {skipped} already existed.")

if __name__ == "__main__":
    asyncio.run(seed_exercises())

