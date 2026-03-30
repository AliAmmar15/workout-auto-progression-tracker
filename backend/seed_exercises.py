"""
Seed all canonical exercises into the database via the REST API.

Reads directly from the exercise_registry so metadata is always in sync.
Skips exercises that already exist (409) and reports a summary.
"""
import sys
import asyncio

import httpx

# Allow running from the backend/ directory without installing the package
sys.path.insert(0, ".")

from app.utils.exercise_registry import CANONICAL_EXERCISES  # noqa: E402


async def seed_exercises(base_url: str = "http://localhost:8000") -> None:
    exercises = [
        {
            "name": meta["display_name"],
            "muscle_group": meta["muscle_group"],
            "equipment": meta.get("equipment", "none"),
            "exercise_type": meta.get("exercise_type"),
            "rep_range_min": meta.get("rep_range_min"),
            "rep_range_max": meta.get("rep_range_max"),
            "progression_rate": meta.get("progression_rate"),
        }
        for meta in CANONICAL_EXERCISES.values()
    ]

    async with httpx.AsyncClient() as client:
        added = 0
        skipped = 0
        failed = 0
        for ex in exercises:
            response = await client.post(
                f"{base_url}/api/v1/exercises",
                json={k: v for k, v in ex.items() if v is not None},
            )
            if response.status_code == 201:
                print(f"✅ Added:   {ex['name']}")
                added += 1
            elif response.status_code == 409:
                print(f"⏭  Exists:  {ex['name']}")
                skipped += 1
            else:
                print(f"❌ Failed:  {ex['name']} — {response.status_code} {response.text}")
                failed += 1

        print(f"\nDone. {added} added, {skipped} already existed, {failed} failed.")


if __name__ == "__main__":
    asyncio.run(seed_exercises())


