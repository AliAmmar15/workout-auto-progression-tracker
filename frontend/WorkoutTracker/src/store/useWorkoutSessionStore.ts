import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseResponse } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SetEntry {
  set_number: number;
  weight: string;
  reps: string;
  rpe: string;
}

export interface SelectedExercise {
  exercise: ExerciseResponse;
  sets: SetEntry[];
}

// ─── Store State & Actions ────────────────────────────────────────────────────

interface WorkoutSessionState {
  // Persisted across sessions
  recentlyUsedExerciseIds: (string | number)[];

  // Ephemeral session state (cleared on resetSession)
  selectedMuscle: string;
  selectedExercises: SelectedExercise[];
  suggestedWeights: Record<string | number, number>;
  notes: string;

  // Actions
  setMuscle: (muscle: string) => void;
  toggleExercise: (ex: ExerciseResponse) => void;
  addSet: (exerciseId: string | number) => void;
  removeSet: (exerciseId: string | number, idx: number) => void;
  updateSet: (exerciseId: string | number, idx: number, field: 'weight' | 'reps' | 'rpe', value: string) => void;
  removeExercise: (exerciseId: string | number) => void;
  setSuggestedWeights: (weights: Record<string | number, number>) => void;
  setNotes: (notes: string) => void;
  /** Prepend new exercise IDs to recentlyUsedExerciseIds, dedupe, cap at 20. */
  updateRecentlyUsed: (ids: (string | number)[]) => void;
  /** Reset all ephemeral session state. Does NOT clear recentlyUsedExerciseIds. */
  resetSession: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const useWorkoutSessionStore = create<WorkoutSessionState>()(
  persist(
    (set) => ({
      // Persisted
      recentlyUsedExerciseIds: [],

      // Ephemeral
      selectedMuscle: '',
      selectedExercises: [],
      suggestedWeights: {},
      notes: '',

      setMuscle: (muscle) =>
        set({ selectedMuscle: muscle }),

      toggleExercise: (ex) =>
        set((state) => {
          const exists = state.selectedExercises.some((se) => se.exercise.id === ex.id);
          if (exists) {
            return {
              selectedExercises: state.selectedExercises.filter((se) => se.exercise.id !== ex.id),
            };
          }
          return {
            selectedExercises: [
              ...state.selectedExercises,
              { exercise: ex, sets: [{ set_number: 1, weight: '', reps: '', rpe: '' }] },
            ],
          };
        }),

      addSet: (exerciseId) =>
        set((state) => ({
          selectedExercises: state.selectedExercises.map((se) =>
            se.exercise.id === exerciseId
              ? {
                  ...se,
                  sets: [...se.sets, { set_number: se.sets.length + 1, weight: '', reps: '', rpe: '' }],
                }
              : se,
          ),
        })),

      removeSet: (exerciseId, idx) =>
        set((state) => ({
          selectedExercises: state.selectedExercises.map((se) => {
            if (se.exercise.id !== exerciseId) return se;
            const newSets = se.sets
              .filter((_, i) => i !== idx)
              .map((s, i) => ({ ...s, set_number: i + 1 }));
            return { ...se, sets: newSets };
          }),
        })),

      updateSet: (exerciseId, idx, field, value) =>
        set((state) => ({
          selectedExercises: state.selectedExercises.map((se) =>
            se.exercise.id === exerciseId
              ? {
                  ...se,
                  sets: se.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
                }
              : se,
          ),
        })),

      removeExercise: (exerciseId) =>
        set((state) => ({
          selectedExercises: state.selectedExercises.filter(
            (se) => se.exercise.id !== exerciseId,
          ),
        })),

      setSuggestedWeights: (weights) => set({ suggestedWeights: weights }),

      setNotes: (notes) => set({ notes }),

      updateRecentlyUsed: (ids) =>
        set((state) => {
          const merged = [...ids, ...state.recentlyUsedExerciseIds];
          // Dedupe while preserving order (newest first)
          const seen = new Set<string | number>();
          const deduped: (string | number)[] = [];
          for (const id of merged) {
            if (!seen.has(id)) {
              seen.add(id);
              deduped.push(id);
            }
          }
          return { recentlyUsedExerciseIds: deduped.slice(0, 20) };
        }),

      resetSession: () =>
        set({
          selectedMuscle: '',
          selectedExercises: [],
          suggestedWeights: {},
          notes: '',
        }),
    }),
    {
      name: 'workout-session-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the recently used list; all session state is ephemeral
      partialize: (state) => ({ recentlyUsedExerciseIds: state.recentlyUsedExerciseIds }),
    },
  ),
);

export default useWorkoutSessionStore;
