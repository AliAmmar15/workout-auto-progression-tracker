/**
 * Typed API client for the Workout Progression Tracker backend.
 * All functions accept a JWT token and return typed response objects.
 */

import { BASE_URL } from '../config';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface ExerciseResponse {
  id: string;
  canonical_name: string;
  display_name: string;
  name: string;
  muscle_group: string;
  equipment: string;
  is_custom: boolean;
  user_id: number | null;
  exercise_type: string | null;
  rep_range_min: number | null;
  rep_range_max: number | null;
  progression_rate: number | null;
  created_at: string;
}

export interface WorkoutSetResponse {
  id: number;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  rpe: number | null;
}

export interface WorkoutResponse {
  id: number;
  user_id: number;
  date: string;
  notes: string | null;
  created_at: string;
  sets: WorkoutSetResponse[];
}

export interface ProgressionResponse {
  exercise_id: string;
  exercise_name: string;
  recent_sets: { weight: number; reps: number }[];
  trend: string;
  plateau_detected: boolean;
  is_pr: boolean;
  last_outcome: string | null;
}

export interface RecommendationResponse {
  exercise_id: string;
  action: string;
  next_weight: number;
  target_reps: number | string;
  reasoning: string;
  is_deload: boolean;
}

export interface WorkoutLogSet {
  exercise_id: string | number;
  set_number: number;
  weight: number;
  reps: number;
  rpe?: number;
}

export interface WorkoutLogCreate {
  date: string;
  notes?: string;
  sets: WorkoutLogSet[];
}

export interface WorkoutProgressionItem {
  exercise_id: string;
  exercise_name: string;
  action: 'increase' | 'maintain' | 'decrease' | 'deload';
  next_weight: number;
  reasoning: string;
}

export interface WorkoutLogResponse {
  id: number;
  user_id: number;
  date: string;
  notes: string | null;
  sets: WorkoutSetResponse[];
  progressions: WorkoutProgressionItem[];
  message: string;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

// --------------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<TokenResponse>(res);
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<UserResponse> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  return handleResponse<UserResponse>(res);
}

// --------------------------------------------------------------------------
// Exercises
// --------------------------------------------------------------------------

export async function getExercises(token: string): Promise<ExerciseResponse[]> {
  const res = await fetch(`${BASE_URL}/exercises`, { headers: authHeaders(token) });
  return handleResponse<ExerciseResponse[]>(res);
}

export async function getExerciseById(token: string, exerciseId: string | number): Promise<ExerciseResponse> {
  const res = await fetch(`${BASE_URL}/exercises/${exerciseId}`, { headers: authHeaders(token) });
  return handleResponse<ExerciseResponse>(res);
}

export async function createExercise(
  token: string,
  data: { name: string; muscle_group: string; equipment: string },
): Promise<ExerciseResponse> {
  // Map to the custom exercise endpoint which sets is_custom=true and user_id
  const validEquipment = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
  const equipment = validEquipment.includes(data.equipment.toLowerCase())
    ? data.equipment.toLowerCase()
    : 'bodyweight';

  const res = await fetch(`${BASE_URL}/exercises/custom`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      display_name: data.name,
      muscle_group: data.muscle_group,
      equipment,
    }),
  });
  return handleResponse<ExerciseResponse>(res);
}

export async function getExerciseRecommendation(
  token: string,
  exerciseId: string | number,
): Promise<RecommendationResponse> {
  const res = await fetch(`${BASE_URL}/exercises/${exerciseId}/recommendation`, {
    headers: authHeaders(token),
  });
  return handleResponse<RecommendationResponse>(res);
}

// --------------------------------------------------------------------------
// Workouts
// --------------------------------------------------------------------------

export async function getWorkouts(
  token: string,
  filters?: { date_from?: string; date_to?: string },
): Promise<WorkoutResponse[]> {
  const params = new URLSearchParams();
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to)   params.set('date_to',   filters.date_to);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${BASE_URL}/workouts${query}`, { headers: authHeaders(token) });
  return handleResponse<WorkoutResponse[]>(res);
}

export async function getWorkoutById(token: string, id: number): Promise<WorkoutResponse> {
  const res = await fetch(`${BASE_URL}/workouts/${id}`, { headers: authHeaders(token) });
  return handleResponse<WorkoutResponse>(res);
}

export async function deleteWorkout(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/workouts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Delete failed');
  }
}

export async function logWorkout(token: string, data: WorkoutLogCreate): Promise<WorkoutLogResponse> {
  const res = await fetch(`${BASE_URL}/workouts/log`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<WorkoutLogResponse>(res);
}

// --------------------------------------------------------------------------
// Progression
// --------------------------------------------------------------------------

export async function getProgression(
  token: string,
  exerciseId: string | number,
): Promise<ProgressionResponse> {
  const res = await fetch(`${BASE_URL}/exercises/${exerciseId}/progression`, {
    headers: authHeaders(token),
  });
  return handleResponse<ProgressionResponse>(res);
}

export async function getRecommendation(
  token: string,
  exerciseId: string | number,
): Promise<RecommendationResponse> {
  const res = await fetch(`${BASE_URL}/exercises/${exerciseId}/recommendation`, {
    headers: authHeaders(token),
  });
  return handleResponse<RecommendationResponse>(res);
}
