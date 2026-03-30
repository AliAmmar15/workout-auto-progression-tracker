# FULL SYSTEM TESTING AUDIT REPORT

**Project:** Workout Progress Tracker  
**Date:** March 30, 2026  
**Auditor:** Automated Testing Agent  
**Scope:** Full-stack testing audit (Backend + Frontend + Data Integrity)

---

## EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Total Issues Found** | 38 |
| **Critical Bugs** | 5 |
| **High Severity** | 11 |
| **Medium Severity** | 14 |
| **Low Severity** | 8 |
| **Unit Tests: Passing** | 90 / 125 |
| **Unit Tests: Failing (ERROR)** | 35 / 125 |
| **Live API Tests Executed** | 28 |
| **System Reliability** | **MODERATE** — core features work, but critical code defects and missing validations present |

---

## TEST METHODOLOGY

### Areas Tested
1. Backend unit test suite (125 tests)
2. Live API endpoint testing (28 adversarial tests)
3. Authentication & authorization flows
4. Exercise CRUD and normalization
5. Workout logging and set management
6. Progression algorithm (pure functions + DB-backed orchestration)
7. Cross-user data isolation
8. Input validation and boundary testing
9. Frontend code static analysis (14 files)
10. Frontend-backend data contract consistency

### Tools Used
- pytest (backend unit tests)
- Python `requests` library (live API testing)
- Static code analysis (manual review)

---

## 1. BUGS

### BUG-001: Missing `uuid4` Import Breaks 35 Tests — ✅ FIXED
- **Severity:** CRITICAL
- **Status:** FIXED — Added `from uuid import uuid4` to `backend/app/models/exercise.py`
- **Description:** The Exercise model's `canonical_name` column uses `default=lambda: f"custom_{uuid4().hex}"` but `uuid4` is never imported.
- **Steps to Reproduce:** Run `pytest tests/` — 35 tests ERROR with `NameError: name 'uuid4' is not defined`
- **Expected:** All 125 tests pass
- **Actual:** 90 pass, 35 error. Any code path that creates an Exercise without explicitly setting `canonical_name` will crash at runtime.
- **Fix:** Add `from uuid import uuid4` to `backend/app/models/exercise.py`

### BUG-002: Duplicate `login()` Function in Auth Service — ✅ FIXED
- **Severity:** HIGH
- **Status:** FIXED — Removed duplicate function from `backend/app/services/auth_service.py`
- **Description:** The `login()` function is defined twice. The second definition silently overrides the first. Both are identical, but this indicates a copy-paste error and is a maintenance hazard.
- **Steps to Reproduce:** Read `auth_service.py` — the function appears at line 36 and again at line 52.
- **Expected:** Single function definition
- **Actual:** Duplicate definition; the second shadows the first
- **Fix:** Delete the duplicate function (lines 52-60)

### BUG-003: Future/Ancient Dates Accepted for Workouts — ✅ FIXED
- **Severity:** HIGH
- **Status:** FIXED — Added `validate_date_bounds` validator to `WorkoutLogCreate`, `WorkoutCreate`, and `WorkoutUpdate` (rejects future dates and dates before year 2000)
- **Description:** Workout dates have no bounds validation. Both `WorkoutLogCreate` and `WorkoutCreate` accept any valid date string.
- **Steps to Reproduce:** `POST /api/v1/workouts/log` with `"date": "2099-12-31"` → 201 Created. Same with `"date": "1900-01-01"`.
- **Expected:** Future dates should be rejected. Dates before ~2000 should be rejected.
- **Actual:** API returns 201 for year 2099 and year 1900
- **Impact:** Corrupts progression calculations (sets in year 2099 would be "most recent"), clutters history

### BUG-004: Duplicate Set Numbers Allowed in Same Workout — ✅ FIXED
- **Severity:** HIGH
- **Status:** FIXED — Added duplicate `set_number` validation in `workout_log_service.py` (returns 422)
- **Description:** No validation prevents multiple sets with the same `set_number` in a single workout log request.
- **Steps to Reproduce:** Log workout with two sets both having `set_number: 1` → 201 Created
- **Expected:** Duplicate set numbers within same workout should be rejected (422)
- **Actual:** Both sets stored with set_number=1, causing ambiguous ordering
- **Impact:** History display and progression analysis use set_number for ordering; duplicates corrupt this

### BUG-005: No Upper Bound on Weight/Reps — ✅ FIXED
- **Severity:** HIGH
- **Status:** FIXED — Added `le=2000` on weight and `le=500` on reps in `WorkoutSetCreate`
- **Description:** `weight` has `ge=0` but no max, `reps` has `ge=1` but no max. Users can log 999,999,999 lbs or 999,999,999 reps.
- **Steps to Reproduce:** `POST /api/v1/workouts/log` with `weight: 999999999` → 201 Created
- **Expected:** Reasonable upper bounds (e.g., weight ≤ 2000, reps ≤ 500)
- **Actual:** No upper bound; extreme values accepted
- **Impact:** Corrupts progression calculations (`calculate_next_weight` on 999M produces nonsensical results), breaks dashboard volume charts

### BUG-006: Frontend-Backend Type Mismatch on Exercise ID — ✅ FIXED
- **Severity:** CRITICAL
- **Status:** FIXED — Changed `ExerciseResponse.id` to `string`, updated all `exercise_id` types in frontend interfaces, store, and components
- **Description:** Backend returns `exercise_id` and `id` as **string** (coerced via `field_validator`). Frontend TypeScript interface declares `id: number` and `exercise_id: number`.
- **Steps to Reproduce:** Call `GET /exercises` → backend returns `{"id": "108", ...}`. Frontend expects `{"id": 108, ...}`.
- **Expected:** Consistent types across the stack
- **Actual:** Backend sends strings, frontend expects numbers. Strict equality checks (`===`) will fail. Any `exercise_id === someNumber` comparison returns false.
- **Impact:** Exercise selection, progression lookups, and history grouping may silently break depending on comparison operators used

### BUG-007: Frontend ExerciseResponse Interface Missing Fields — ✅ FIXED
- **Severity:** CRITICAL
- **Status:** FIXED — `ExerciseResponse` updated to include all 13 backend fields
- **Description:** Frontend `ExerciseResponse` has 4 fields (`id`, `name`, `muscle_group`, `equipment`). Backend returns 13 fields including `display_name`, `canonical_name`, `is_custom`, `exercise_type`, `rep_range_min`, `rep_range_max`, `progression_rate`, `created_at`, `user_id`.
- **Steps to Reproduce:** Compare the interface at api.ts:28 with actual API response
- **Expected:** Frontend type matches backend response shape
- **Actual:** Frontend type is severely incomplete. While extra fields are silently ignored by TypeScript at runtime, any code trying to access `exercise_type` or `display_name` has no type safety.
- **Impact:** TypeScript provides false sense of type safety; accessing missing properties returns undefined without compiler warning

### BUG-008: Non-Sequential Set Numbers Accepted
- **Severity:** MEDIUM
- **File:** `backend/app/services/workout_log_service.py`
- **Description:** Set numbers like 5, 99 are accepted without validation. No check that set numbers are sequential starting from 1.
- **Steps to Reproduce:** Log workout with set_number values [5, 99] → 201 Created
- **Expected:** Validation that set numbers are sequential (1, 2, 3...)
- **Actual:** Any positive integers accepted

### BUG-009: XSS Content Stored Without Sanitization
- **Severity:** MEDIUM
- **File:** `backend/app/services/exercise_service.py`, `backend/app/services/workout_log_service.py`
- **Description:** HTML/script content is stored verbatim in exercise names and workout notes. While the React Native frontend doesn't render raw HTML, this is a risk if data is ever displayed in a web context.
- **Steps to Reproduce:** Create exercise named `<script>alert(1)</script>` → 201 Created; content stored as-is
- **Expected:** Input sanitization or output encoding
- **Actual:** Raw HTML/JS stored in database

### BUG-010: Exercise Update/Delete Returns 500 Instead of 403
- **Severity:** MEDIUM
- **File:** `backend/app/api/routes/exercises.py`, `backend/app/services/exercise_service.py`
- **Description:** When User B tries to update/delete User A's exercise, the server returns 500 (Internal Server Error) instead of 403 (Forbidden) or 404.
- **Steps to Reproduce:** User A creates exercise. User B calls `PUT /exercises/{id}` or `DELETE /exercises/{id}` → 500
- **Expected:** 403 Forbidden or 404 Not Found
- **Actual:** 500 Internal Server Error (likely unhandled exception in ownership check)
- **Impact:** Bad error messages for the user; unhandled exception in server logs

### BUG-011: 100 Sets Per Workout Allowed Without Limit
- **Severity:** LOW
- **File:** `backend/app/schemas/workout_log.py`
- **Description:** `WorkoutLogCreate.sets` requires `min_length=1` but has no `max_length`. 100+ sets are accepted.
- **Steps to Reproduce:** Send workout with 100 sets → 201 Created
- **Expected:** Reasonable upper limit (e.g., 50 sets)
- **Actual:** Unlimited sets; potential performance issue with large payloads

---

## 2. LOGIC ISSUES

### LOGIC-001: Progression Analyzes Only Last 5 Sets Globally, Not Per-Session
- **File:** `backend/app/services/progression_service.py` line 182-188
- **Description:** `analyze_progression()` queries the last 5 sets across ALL sessions. If a user logs 3 sets per session, the "last 5 sets" spans just ~2 sessions. The plateau detection checks the outcomes of these 5 individual sets, not 3 complete sessions.
- **Impact:** Plateau is detected after 3 bad **sets** (could be from 1 session), not 3 bad **sessions** as the documentation implies. A single bad workout with 3+ sets below range triggers an incorrect plateau.

### LOGIC-002: PR Detection Uses Only Weight, Ignores Reps
- **File:** `backend/app/services/progression_service.py` lines 207-213
- **Description:** PR (Personal Record) is detected by comparing `sets[-1].weight > previous_max_weight`. But a user lifting 135 lbs × 12 reps after previously doing 135 lbs × 8 reps is also a PR (rep PR), which is not detected.
- **Impact:** Users miss rep-based PRs; only weight increases flagged

### LOGIC-003: Bodyweight Escalation Check Uses Weight Field Incorrectly
- **File:** `backend/app/services/progression_service.py` line 277
- **Description:** When bodyweight escalation is detected, `next_weight` is set to `last_weight` (current weight). For pure bodyweight exercises, `last_weight` is typically 0.0. The recommendation says "add external weight" but suggests 0.0 lbs.
- **Impact:** Useless recommendation: "Add external weight. Next weight: 0.0 lbs"

### LOGIC-004: Dashboard "Top Lift" Ranked by Frequency, Not Progress
- **File:** `frontend/WorkoutTracker/src/screens/DashboardScreen.tsx`
- **Description:** "Top Lift" is determined by number of sets, not actual performance improvement. An exercise logged 100 times with no progress ranks higher than one with significant gains.
- **Impact:** Misleading to users; doesn't reflect actual achievement

### LOGIC-005: Profile Screen Progression Compares Only 2 Most Recent Sets
- **File:** `frontend/WorkoutTracker/src/screens/ProfileScreen.tsx`
- **Description:** The progression summary compares only the last two sets per exercise. A single bad day shows "regressing" even with a long-term improvement trend.
- **Impact:** Inaccurate fitness summary on profile page

### LOGIC-006: Volume Calculation Trusts Unvalidated Data
- **File:** `frontend/WorkoutTracker/src/screens/WorkoutHistoryScreen.tsx`
- **Description:** `totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0)`. No null checks on `s.weight` or `s.reps`. If backend returns null for either, produces `NaN`.
- **Impact:** Displays "NaN lbs" in volume totals if any set has missing data

---

## 3. UX ISSUES

### UX-001: No Loading Indicator During Recommendation Fetch
- **File:** `frontend/WorkoutTracker/src/screens/WorkoutLogScreen.tsx`
- **Description:** `handleContinueToSets()` makes parallel API calls for recommendations with `Promise.allSettled()` but shows no spinner or feedback. UI appears frozen during network delays.

### UX-002: Equipment Silently Mapped to 'bodyweight'
- **File:** `frontend/WorkoutTracker/src/services/api.ts` `createExercise()`
- **Description:** If user enters invalid equipment string, it's silently converted to 'bodyweight' with no feedback. User thinks they entered "bands" but exercise is saved as "bodyweight".

### UX-003: Date Input Not Validated on Frontend
- **File:** `frontend/WorkoutTracker/src/components/workout/WorkoutBuilder.tsx`
- **Description:** Date input accepts any string. User can type "invalid-date" and it's sent to the backend. Backend will reject it, but frontend shows a generic error.

### UX-004: Goal Per Month Not Persisted
- **File:** `frontend/WorkoutTracker/src/screens/DashboardScreen.tsx`
- **Description:** Monthly workout goal is local state. Closing and reopening the app resets it to the default. Users must re-enter their goal every session.

### UX-005: Month Offset Has No Bounds
- **File:** `frontend/WorkoutTracker/src/screens/DashboardScreen.tsx`
- **Description:** Users can navigate infinitely into the future/past with month arrows. No indication of current month or bounds.

### UX-006: BMI Calculator State Not Tied to Profile
- **File:** `frontend/WorkoutTracker/src/screens/ProfileScreen.tsx`
- **Description:** BMI calculator uses hardcoded defaults and local state, not the user's actual weight/height from their profile. Confusing since it's on the profile page.

### UX-007: No Error Boundary in App
- **File:** `frontend/WorkoutTracker/App.tsx`
- **Description:** No React error boundary. If any screen throws, the entire app crashes with no recovery option.

### UX-008: No Token Expiration Handling
- **File:** `frontend/WorkoutTracker/src/store/useAuthStore.ts`
- **Description:** JWT tokens expire after 60 minutes but the app never checks or refreshes. After expiry, all API calls silently fail until manual re-login.

---

## 4. EDGE CASE FAILURES

### EDGE-001: Float Reps Rejected (Good)
- Input: `reps: 10.5` → 422 Validation Error
- **Status:** Correctly handled

### EDGE-002: Negative Weight Rejected (Good)
- Input: `weight: -50` → 422 Validation Error
- **Status:** Correctly handled

### EDGE-003: RPE Boundary Validation Works (Good)
- Input: `rpe: 0` → 422; `rpe: 11` → 422; `rpe: null` → Accepted
- **Status:** Correctly handled (1-10 range enforced)

### EDGE-004: Empty Sets Rejected (Good)
- Input: `sets: []` → 422 Validation Error
- **Status:** Correctly handled (`min_length=1`)

### EDGE-005: Invalid Token Returns 401 (Good)
- Input: `Authorization: Bearer invalid.token` → 401
- **Status:** Correctly handled

### EDGE-006: SQL Injection Safe (Good)
- Input: Exercise name `'; DROP TABLE exercises; --` → Stored as literal string
- **Status:** Parameterized queries prevent injection. Content stored verbatim (see BUG-009).

### EDGE-007: Long Exercise Name Rejected (Good)
- Input: 200-char exercise name → 422 (max_length=100 enforced)
- **Status:** Correctly handled

### EDGE-008: Long Notes Rejected (Good)
- Input: 10,000-char notes → 422 (max_length=2000 enforced)
- **Status:** Correctly handled

### EDGE-009: Cross-User Workout Access Blocked (Good)
- User B GET/DELETE User A's workout → 404
- **Status:** Correctly handled (user_id scoping works)

### EDGE-010: Weak Password Rejected (Good)
- Input: 3-char password → 422 (min_length=6 enforced)
- **Status:** Correctly handled

### EDGE-011: Exercise with Emoji/Special Characters
- Input: Exercise name with emojis and HTML entities → 201 Created, stored as-is
- **Status:** Functional but see BUG-009 regarding sanitization

---

## 5. SECURITY ASSESSMENT

### SEC-001: Weak Default JWT Secret (HIGH) — ✅ FIXED
- **File:** `backend/app/config.py`
- `SECRET_KEY` now raises `RuntimeError` at startup if the default key is used when `ENV=production`

### SEC-002: Password Policy Insufficient (MEDIUM)
- Only `min_length=6` enforced. "123456" and "aaaaaa" are accepted.
- No complexity requirements (uppercase, digits, special chars)

### SEC-003: No Rate Limiting on Auth Endpoints (MEDIUM)
- Login endpoint has no throttling. Brute-force password attacks possible.

### SEC-004: CORS Regex Allows Broad Subnet (LOW)
- `allow_origin_regex` matches `10.0.0.*` subnet. Overly permissive for production.

### SEC-005: No HTTPS Enforcement (LOW)
- No redirect or HSTS headers for production deployment

---

## 6. IMPROVEMENTS

### Architecture
1. **Add Alembic migrations** — Currently using `init.sql` with no incremental migration support
2. **Add React Error Boundary** — Prevent entire app crash from component errors
3. **Add request timeout** — All frontend `fetch()` calls have no timeout
4. **Add token refresh mechanism** — Tokens expire silently after 60 minutes

### Reliability
5. **Fix the uuid4 import** — This single missing import breaks 35 tests
6. **Add `max_length` to WorkoutLogCreate.sets** — Prevent 100+ set payloads
7. **Validate workout dates** — Reject future dates and dates before 2000
8. **Add set number uniqueness validation** — Prevent duplicate set_numbers per workout
9. **Add upper bounds to weight (≤2000) and reps (≤500)** — Prevent absurd data

### Data Integrity
10. **Align frontend TypeScript types with backend** — Exercise id is string from backend but number in frontend types
11. **Add experience_level enum** — Currently accepts any string
12. **Add equipment enum validation on backend** — Currently accepts any string for the non-custom endpoint

### Testing
13. **Fix the 35 erroring tests** by adding the missing uuid4 import
14. **Add negative authorization tests** — No tests verify cross-user isolation
15. **Add API integration tests** — Current tests only cover service layer

---

## TEST RESULTS SUMMARY

### Backend Unit Tests
```
Total: 125
Passed: 125 (after fixes — was 90/125 before)
Errors: 0 (was 35 — all caused by missing uuid4 import, now fixed)
Failed: 0
```

### Live API Adversarial Tests
```
Total: 28
Passed (correct behavior): 20
Bugs found: 8
  - Future date accepted (2099)
  - Ancient date accepted (1900)
  - Extreme weight accepted (999M lbs)
  - Duplicate set numbers accepted
  - Non-sequential set numbers accepted
  - Cross-user exercise update returns 500
  - Cross-user exercise delete returns 500
  - XSS content stored without sanitization
```

### Good Security Behavior Confirmed
- SQL injection: SAFE (parameterized queries)
- Cross-user workout access: BLOCKED (404)
- Invalid token: BLOCKED (401)
- Exercise creation without auth: BLOCKED (401)
- Weak passwords: BLOCKED (422)
- Empty/zero input validation: WORKING

---

## SYSTEM RELIABILITY ASSESSMENT

| Area | Rating | Notes |
|------|--------|-------|
| **Authentication** | GOOD | Registration, login, JWT all work correctly |
| **Authorization** | GOOD | Workout isolation works; exercise auth has 500 errors |
| **Workout Logging** | MODERATE | Core flow works but missing validations (dates, set numbers, upper bounds) |
| **Progression** | MODERATE | Algorithm is sound but interpretation of "session" vs "set" is flawed |
| **Exercise System** | MODERATE | Normalization works well; type mismatch with frontend |
| **Frontend Types** | POOR | Significant mismatch with backend response shapes |
| **Test Suite** | POOR | 28% of tests broken by single missing import |
| **Input Validation** | MODERATE | Good for basic ranges; missing date/upper-bound/uniqueness checks |
| **Overall** | **MODERATE** | Core features functional; needs fixes before production |

---

## PRIORITY FIX ORDER

1. **P0 (Fix immediately):** BUG-001 (uuid4 import — unblocks 35 tests), BUG-006/007 (type mismatch)
2. **P1 (Fix this sprint):** BUG-002 (duplicate login), BUG-003 (date validation), BUG-004 (set number uniqueness), BUG-005 (weight/reps upper bounds), BUG-010 (500 errors)
3. **P2 (Fix before release):** LOGIC-001 (plateau per-session), SEC-001 (JWT secret), UX-007 (error boundary), UX-008 (token refresh)
4. **P3 (Backlog):** All remaining medium/low issues
