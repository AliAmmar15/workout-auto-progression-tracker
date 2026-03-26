import urllib.request
import urllib.error
import json

req = urllib.request.Request(
    "http://localhost:8000/api/v1/auth/register",
    data=json.dumps({
        "username": "test_bug101",
        "email": "test_bug101@example.com",
        "password": "password"
    }).encode(),
    headers={"Content-Type": "application/json"}
)
try:
    urllib.request.urlopen(req)
except urllib.error.HTTPError:
    pass

req2 = urllib.request.Request(
    "http://localhost:8000/api/v1/auth/login",
    data=json.dumps({"email": "test_bug101@example.com", "password": "password"}).encode(),
    headers={"Content-Type": "application/json"}
)
resp2 = urllib.request.urlopen(req2)
token = json.loads(resp2.read().decode())["access_token"]

req3 = urllib.request.Request(
    "http://localhost:8000/api/v1/workouts",
    headers={"Authorization": f"Bearer {token}"}
)
try:
    resp3 = urllib.request.urlopen(req3)
    print("Workouts response:", resp3.getcode())
except urllib.error.HTTPError as e:
    print("Workouts response:", e.code)
    print("Error:", e.read().decode())
