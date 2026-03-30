import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import useAuthStore from '../store/useAuthStore';
import useWorkoutSessionStore from '../store/useWorkoutSessionStore';
import {
  getExercises,
  createExercise,
  getExerciseRecommendation,
  ExerciseResponse,
  WorkoutProgressionItem,
} from '../services/api';
import MuscleGrid, { MUSCLE_GROUP_MAP } from '../components/workout/MuscleGrid';
import ExercisePicker from '../components/workout/ExercisePicker';
import WorkoutBuilder from '../components/workout/WorkoutBuilder';
import WorkoutResults from '../components/workout/WorkoutResults';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:       '#0D0E12',
  accent:   '#E8522A',
  warm:     '#F5F0E8',
  muted:    '#52576B',
  negative: '#E84A4A',
};

// ─── Step type ────────────────────────────────────────────────────────────────

type Step = 'muscle' | 'exercises' | 'sets' | 'results';

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WorkoutLogScreen() {
  const token = useAuthStore((s) => s.token);

  // Cached exercise list (fetched once per session)
  const [allExercises, setAllExercises] = useState<ExerciseResponse[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Step & result state
  const [step, setStep] = useState<Step>('muscle');
  const [progressions, setProgressions] = useState<WorkoutProgressionItem[]>([]);

  // Session store
  const { selectedMuscle, setMuscle, setSuggestedWeights, resetSession, selectedExercises } =
    useWorkoutSessionStore();

  // ─── Animation ─────────────────────────────────────────────────────────────

  const opacityAnim = useRef(new Animated.Value(1)).current;
  const slideXAnim  = useRef(new Animated.Value(0)).current;

  function navigate(nextStep: Step, direction: 'forward' | 'back') {
    const exitX  = direction === 'forward' ? -30 : 30;
    const enterX = direction === 'forward' ? 30  : -30;

    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(slideXAnim,  { toValue: exitX, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideXAnim.setValue(enterX);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slideXAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  }

  // ─── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    getExercises(token)
      .then(setAllExercises)
      .catch(() => setFetchError('Could not reach the backend. Make sure the server is running.'))
      .finally(() => setFetching(false));
  }, [token]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleMuscleSelect(muscle: string) {
    setMuscle(muscle);
    navigate('exercises', 'forward');
  }

  async function handleContinueToSets() {
    if (!token) return;
    // Fetch recommendations in parallel; silently ignore failures
    const results = await Promise.allSettled(
      selectedExercises.map((se) =>
        getExerciseRecommendation(token, se.exercise.id).then((r) => ({
          id: se.exercise.id,
          weight: r.next_weight,
        })),
      ),
    );
    const weights: Record<number, number> = {};
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.weight > 0) {
        weights[r.value.id] = r.value.weight;
      }
    }
    setSuggestedWeights(weights);
    navigate('sets', 'forward');
  }

  async function handleCreateExercise(name: string, equipment: string) {
    if (!token) return;
    const dbGroup = MUSCLE_GROUP_MAP[selectedMuscle]?.[0] ?? selectedMuscle ?? 'other';
    const created = await createExercise(token, {
      name,
      muscle_group: dbGroup,
      equipment,
    });
    setAllExercises((prev) => [...prev, created]);
    useWorkoutSessionStore.getState().toggleExercise(created);
  }

  function handleWorkoutSubmit(progs: WorkoutProgressionItem[]) {
    setProgressions(progs);
    navigate('results', 'forward');
  }

  function handleDone() {
    resetSession();
    navigate('muscle', 'back');
  }

  // ─── Loading / Error states ─────────────────────────────────────────────────

  if (fetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Connecting to backend…</Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 32 }}>⚠️</Text>
        <Text style={styles.errorTitle}>Backend Unreachable</Text>
        <Text style={styles.errorBody}>{fetchError}</Text>
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.stepView,
          { opacity: opacityAnim, transform: [{ translateX: slideXAnim }] },
        ]}
      >
        {step === 'muscle' && (
          <MuscleGrid onSelect={handleMuscleSelect} />
        )}

        {step === 'exercises' && (
          <ExercisePicker
            muscleName={selectedMuscle}
            allExercises={allExercises}
            onBack={() => navigate('muscle', 'back')}
            onContinue={handleContinueToSets}
            onCreateExercise={handleCreateExercise}
          />
        )}

        {step === 'sets' && (
          <WorkoutBuilder
            onSubmit={handleWorkoutSubmit}
            onBack={() => navigate('exercises', 'back')}
          />
        )}

        {step === 'results' && (
          <WorkoutResults
            progressions={progressions}
            onDone={handleDone}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  stepView:    { flex: 1 },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingText: { color: C.muted, marginTop: 12, fontSize: 13 },
  errorTitle:  { color: C.negative, fontSize: 15, fontWeight: '600', marginTop: 12 },
  errorBody:   { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },
});
