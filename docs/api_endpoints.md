# API Endpoints

Base URL: `/api/v1`

## Authentication

| Method | Endpoint             | Description          | Request Body                          | Response       |
|--------|----------------------|----------------------|---------------------------------------|----------------|
| POST   | `/auth/register`     | Register new user    | `{ username, email, password }`       | `201` User     |
| POST   | `/auth/login`        | Login                | `{ email, password }`                 | `200` Token    |

---

## Users

| Method | Endpoint             | Description          | Request Body          | Response       |
|--------|----------------------|----------------------|-----------------------|----------------|
| GET    | `/users/me`          | Get current user     | —                     | `200` User     |
| PUT    | `/users/me`          | Update current user  | `{ username, email }` | `200` User     |
| DELETE | `/users/me`          | Delete current user  | —                     | `204`          |

---

## Exercises

| Method | Endpoint              | Description               | Request Body                         | Response          |
|--------|-----------------------|---------------------------|--------------------------------------|-------------------|
| GET    | `/exercises`          | List all exercises        | —                                    | `200` Exercise[]  |
| GET    | `/exercises/{id}`     | Get exercise by ID        | —                                    | `200` Exercise    |
| POST   | `/exercises`          | Create exercise           | `{ name, muscle_group, equipment? }` | `201` Exercise    |
| PUT    | `/exercises/{id}`     | Update exercise           | `{ name?, muscle_group?, equipment? }` | `200` Exercise  |
| DELETE | `/exercises/{id}`     | Delete exercise           | —                                    | `204`             |

**Query Parameters** for `GET /exercises`:
- `muscle_group` — filter by muscle group

---

## Workouts

| Method | Endpoint              | Description               | Request Body            | Response         |
|--------|-----------------------|---------------------------|-------------------------|------------------|
| GET    | `/workouts`           | List user's workouts      | —                       | `200` Workout[]  |
| GET    | `/workouts/{id}`      | Get workout with sets     | —                       | `200` Workout    |
| POST   | `/workouts`           | Create workout            | `{ date, notes? }`      | `201` Workout    |
| PUT    | `/workouts/{id}`      | Update workout            | `{ date?, notes? }`     | `200` Workout    |
| DELETE | `/workouts/{id}`      | Delete workout            | —                       | `204`            |

**Query Parameters** for `GET /workouts`:
- `date_from` — filter start date
- `date_to` — filter end date

---

## Workout Sets

| Method | Endpoint                          | Description         | Request Body                                      | Response          |
|--------|-----------------------------------|---------------------|---------------------------------------------------|-------------------|
| GET    | `/workouts/{workout_id}/sets`     | List sets           | —                                                 | `200` Set[]       |
| POST   | `/workouts/{workout_id}/sets`     | Add set             | `{ exercise_id, set_number, weight, reps, rpe? }`  | `201` Set         |
| PUT    | `/workouts/{workout_id}/sets/{id}`| Update set          | `{ weight?, reps?, rpe? }`                         | `200` Set         |
| DELETE | `/workouts/{workout_id}/sets/{id}`| Delete set          | —                                                 | `204`             |

---

## Progression (Phase 4)

| Method | Endpoint                              | Description              | Response                |
|--------|---------------------------------------|--------------------------|-------------------------|
| GET    | `/exercises/{id}/progression`         | Get progression stats    | `200` Progression      |
| GET    | `/exercises/{id}/recommendation`      | Get next weight/reps     | `200` Recommendation   |

---

## Response Formats

### User
```json
{
  "id": 1,
  "username": "john",
  "email": "john@example.com",
  "created_at": "2026-03-04T00:00:00Z"
}
```

### Exercise
```json
{
  "id": 1,
  "name": "Bench Press",
  "muscle_group": "chest",
  "equipment": "barbell",
  "created_at": "2026-03-04T00:00:00Z"
}
```

### Workout
```json
{
  "id": 1,
  "user_id": 1,
  "date": "2026-03-04",
  "notes": "Push day",
  "sets": [
    {
      "id": 1,
      "exercise_id": 1,
      "set_number": 1,
      "weight": 135.0,
      "reps": 10,
      "rpe": 7
    }
  ],
  "created_at": "2026-03-04T00:00:00Z"
}
```

### Progression
```json
{
  "exercise_id": 1,
  "exercise_name": "Bench Press",
  "recent_sets": [],
  "trend": "improving",
  "plateau_detected": false
}
```

### Recommendation
```json
{
  "exercise_id": 1,
  "recommended_weight": 140.0,
  "recommended_reps": 10,
  "reasoning": "Progressive overload: +5 lbs"
}
```

---

## Error Responses

All errors return:
```json
{
  "detail": "Error message"
}
```

| Code | Meaning               |
|------|-----------------------|
| 400  | Invalid request body  |
| 401  | Not authenticated     |
| 403  | Forbidden             |
| 404  | Resource not found    |
| 409  | Conflict (duplicate)  |
| 422  | Validation error      |

---

## Architecture Notes

All endpoints follow the pattern from `DEVELOPMENT_RULES.md`:

```
Route (thin) → Service (business logic) → Database
```

### Route-to-Service Mapping

| Route File                      | Service File                      |
|---------------------------------|-----------------------------------|
| `api/routes/auth.py`           | `services/auth_service.py`        |
| `api/routes/users.py`          | `services/user_service.py`        |
| `api/routes/exercises.py`      | `services/exercise_service.py`    |
| `api/routes/workouts.py`       | `services/workout_service.py`     |
| `api/routes/workout_sets.py`   | `services/workout_set_service.py` |
| `api/routes/progression.py`    | `services/progression_service.py` |
