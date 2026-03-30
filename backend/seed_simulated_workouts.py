"""
Seed realistic simulated workout sessions into the database via REST API.

What this script does:
1. Registers/logs in a dedicated simulated user
2. Applies the requested user profile attributes
3. Loads canonical session data from simulated_workout_sessions.json
4. Resolves canonical exercise names to existing exercise IDs
5. Logs each workout through /api/v1/workouts/log

Prerequisite:
- Canonical exercises should already exist in DB (run seed_exercises.py first)
"""

import asyncio
import json
import sys
from pathlib import Path

import httpx

# Allow running from backend/ without installation
sys.path.insert(0, ".")

from app.utils.exercise_registry import normalize_exercise_name  # noqa: E402


DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_DATA_FILE = Path("simulated_workout_sessions.json")

SIM_USER = {
    "username": "sim_intermediate_01",
    "email": "sim_intermediate_01@example.com",
    "password": "SimData123!",
    "weight_lbs": 180,
    "height_inches": 70,
    "age": 20,
    "experience_level": "intermediate",
}


async def ensure_user_and_token(client: httpx.AsyncClient, base_url: str) -> str:
    register_resp = await client.post(f"{base_url}/api/v1/auth/register", json=SIM_USER)
    if register_resp.status_code not in (201, 409):
        raise RuntimeError(
            f"Register failed: {register_resp.status_code} {register_resp.text}"
        )

    login_resp = await client.post(
        f"{base_url}/api/v1/auth/login",
        json={"email": SIM_USER["email"], "password": SIM_USER["password"]},
    )
    if login_resp.status_code != 200:
        raise RuntimeError(f"Login failed: {login_resp.status_code} {login_resp.text}")

    return login_resp.json()["access_token"]


async def update_profile(client: httpx.AsyncClient, base_url: str, token: str) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    profile_payload = {
        "weight_lbs": SIM_USER["weight_lbs"],
        "height_inches": SIM_USER["height_inches"],
        "age": SIM_USER["age"],
        "experience_level": SIM_USER["experience_level"],
    }
    resp = await client.put(
        f"{base_url}/api/v1/users/me", json=profile_payload, headers=headers
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"Profile update failed: {resp.status_code} {resp.text}"
        )


async def fetch_exercise_map(client: httpx.AsyncClient, base_url: str) -> dict[str, int]:
    resp = await client.get(f"{base_url}/api/v1/exercises")
    if resp.status_code != 200:
        raise RuntimeError(f"Fetch exercises failed: {resp.status_code} {resp.text}")

    exercise_map: dict[str, int] = {}
    for exercise in resp.json():
        raw_name = str(exercise["name"])
        canonical = normalize_exercise_name(raw_name)
        if canonical:
            exercise_map[canonical] = exercise["id"]

    return exercise_map


def load_sessions(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def build_log_payload(session: dict, exercise_map: dict[str, int]) -> dict:
    flat_sets: list[dict] = []

    for exercise in session["exercises"]:
        canonical_name = exercise.get("canonical_name") or exercise.get("name")
        if not canonical_name:
            raise KeyError("Each exercise must include canonical_name")
        if canonical_name not in exercise_map:
            raise KeyError(
                f"Missing exercise '{canonical_name}' in DB. "
                "Run seed_exercises.py before this script."
            )

        exercise_id = exercise_map[canonical_name]
        for index, set_data in enumerate(exercise["sets"], start=1):
            flat_sets.append(
                {
                    "exercise_id": exercise_id,
                    "set_number": index,
                    "weight": float(set_data["weight"]),
                    "reps": int(set_data["reps"]),
                }
            )

    details = [
        f"type={session['workout_type']}",
        f"outcome={session.get('performance_outcome', 'unknown')}",
    ]
    if session.get("notes"):
        details.append(session["notes"])

    return {
        "date": session["date"],
        "notes": " | ".join(details),
        "sets": flat_sets,
    }


async def seed_simulated_workouts(
    base_url: str = DEFAULT_BASE_URL,
    data_file: Path = DEFAULT_DATA_FILE,
) -> None:
    sessions = load_sessions(data_file)

    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await ensure_user_and_token(client, base_url)
        await update_profile(client, base_url, token)
        exercise_map = await fetch_exercise_map(client, base_url)

        headers = {"Authorization": f"Bearer {token}"}

        created = 0
        failed = 0
        for session in sessions:
            payload = build_log_payload(session, exercise_map)
            resp = await client.post(
                f"{base_url}/api/v1/workouts/log", json=payload, headers=headers
            )

            if resp.status_code == 201:
                created += 1
                print(f"Created {session['date']} {session['workout_type']}")
            else:
                failed += 1
                print(
                    f"Failed {session['date']} {session['workout_type']} -> "
                    f"{resp.status_code} {resp.text}"
                )

    print(f"\nDone. {created} sessions created, {failed} failed.")


if __name__ == "__main__":
    asyncio.run(seed_simulated_workouts())
