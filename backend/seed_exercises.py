import httpx
import asyncio

async def seed_exercises():
    exercises = [
        {"name": "Barbell Squat", "muscle_group": "Legs", "equipment": "Barbell"},
        {"name": "Bench Press", "muscle_group": "Chest", "equipment": "Barbell"},
        {"name": "Deadlift", "muscle_group": "Back", "equipment": "Barbell"},
        {"name": "Overhead Press", "muscle_group": "Shoulders", "equipment": "Barbell"},
        {"name": "Pull Up", "muscle_group": "Back", "equipment": "Bodyweight"},
        {"name": "Barbell Row", "muscle_group": "Back", "equipment": "Barbell"},
        {"name": "Dumbbell Curl", "muscle_group": "Biceps", "equipment": "Dumbbell"},
        {"name": "Triceps Extension", "muscle_group": "Triceps", "equipment": "Dumbbell"},
        {"name": "Leg Press", "muscle_group": "Legs", "equipment": "Machine"},
        {"name": "Calf Raise", "muscle_group": "Legs", "equipment": "Machine"},
    ]
    
    async with httpx.AsyncClient() as client:
        for ex in exercises:
            response = await client.post("http://localhost:8000/api/v1/exercises", json=ex)
            if response.status_code == 201:
                print(f"Added: {ex['name']}")
            elif response.status_code == 409:
                print(f"Already exists: {ex['name']}")
            else:
                print(f"Failed to add {ex['name']}: {response.text}")

if __name__ == "__main__":
    asyncio.run(seed_exercises())
