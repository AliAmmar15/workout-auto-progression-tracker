import urllib.request
import urllib.error
import json

req = urllib.request.Request(
    "http://localhost:8000/api/v1/auth/login",
    data=json.dumps({"email": "test_bug101@example.com", "password": "password"}).encode(),
    headers={"Content-Type": "application/json"}
)
resp = urllib.request.urlopen(req)
token = json.loads(resp.read().decode())["access_token"]

# Get exercises
req_ex = urllib.request.Request(
    "http://localhost:8000/api/v1/exercises",
    headers={"Authorization": f"Bearer {token}"}
)
ex_resp = urllib.request.urlopen(req_ex)
exercises = json.loads(ex_resp.read().decode())
ex_id = exercises[0]["id"]

# Log a workout
log_data = {
    "date": "2026-03-25",
    "notes": "Test workout",
    "sets": [
        {"exercise_id": ex_id, "set_number": 1, "weight": 135.0, "reps": 5}
    ]
}

req_log = urllib.request.Request(
    "http://localhost:8000/api/v1/workouts/log",
    data=json.dumps(log_data).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
)

try:
    log_resp = urllib.request.urlopen(req_log)
    print("Log response:", log_resp.getcode())
    print(log_resp.read().decode())
except urllib.error.HTTPError as e:
    print("Log error:", e.code)
    print(e.read().decode())
