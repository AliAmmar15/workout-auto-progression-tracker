import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import useAuthStore from '../store/useAuthStore';
import { getExercises, logWorkout, ExerciseResponse } from '../services/api';

interface SetEntry {
  exercise_id: number;
  set_number: number;
  weight: string;
  reps: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLocalDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message || ''}`);
  } else {
    Alert.alert(title, message || '');
  }
}

/**
 * WorkoutLogScreen — allows the authenticated user to log a workout.
 * Fetches the exercise catalog, builds a dynamic set list, and submits
 * the complete workout log via POST /workouts/log atomically.
 */
export default function WorkoutLogScreen() {
  const token = useAuthStore((s) => s.token);
  const [exercises, setExercises] = useState<ExerciseResponse[]>([]);
  const [sets, setSets] = useState<SetEntry[]>([
    { exercise_id: 0, set_number: 1, weight: '', reps: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getExercises(token)
      .then(setExercises)
      .catch(() => setFetchError('Could not reach backend. Make sure the server is running on port 8000.'))
      .finally(() => setFetching(false));
  }, [token]);

  function addSet() {
    setSets((prev) => [
      ...prev,
      { exercise_id: 0, set_number: prev.length + 1, weight: '', reps: '' },
    ]);
  }

  function updateSet(index: number, field: keyof SetEntry, value: string | number) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  async function handleSubmit() {
    if (!token) return;

    const invalidSets = sets.filter(
      (s) => !s.exercise_id || !s.weight || !s.reps,
    );
    if (invalidSets.length > 0) {
      showAlert('Validation', 'Please fill in all set fields and select an exercise.');
      return;
    }

    setLoading(true);
    try {
      await logWorkout(token, {
        date: getLocalDateStr(),
        notes: notes || undefined,
        sets: sets.map((s) => ({
          exercise_id: s.exercise_id,
          set_number: s.set_number,
          weight: parseFloat(s.weight),
          reps: parseInt(s.reps, 10),
        })),
      });
      showAlert('✅ Workout Logged!', 'Your workout has been saved.');
      setSets([{ exercise_id: 0, set_number: 1, weight: '', reps: '' }]);
      setNotes('');
    } catch (err: any) {
      showAlert('Error', err.message ?? 'Failed to log workout.');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={{ color: '#888', marginTop: 12, fontSize: 13 }}>Connecting to backend...</Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 32 }}>⚠️</Text>
        <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: '600', marginTop: 12 }}>Backend Unreachable</Text>
        <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 }}>{fetchError}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Log Workout</Text>

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Heavy day, felt strong"
        placeholderTextColor="#888"
        value={notes}
        onChangeText={setNotes}
      />

      {sets.map((set, index) => (
        <View key={index} style={styles.setCard}>
          <Text style={styles.setTitle}>Set {set.set_number}</Text>

          <Text style={styles.label}>Exercise</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {exercises.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={[styles.pill, set.exercise_id === ex.id && styles.pillActive]}
                onPress={() => updateSet(index, 'exercise_id', ex.id)}
              >
                <Text style={[styles.pillText, set.exercise_id === ex.id && styles.pillTextActive]}>
                  {ex.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Weight (lbs)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="135"
                placeholderTextColor="#888"
                value={set.weight}
                onChangeText={(v) => updateSet(index, 'weight', v)}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Reps</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="5"
                placeholderTextColor="#888"
                value={set.reps}
                onChangeText={(v) => updateSet(index, 'reps', v)}
              />
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addButton} onPress={addSet}>
        <Text style={styles.addButtonText}>+ Add Set</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Save Workout</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  content: { padding: 20, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F1A' },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 20 },
  label: { fontSize: 13, color: '#aaa', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  setCard: {
    backgroundColor: '#14142A',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  setTitle: { fontSize: 16, fontWeight: '600', color: '#6C63FF' },
  pillRow: { flexDirection: 'row', marginVertical: 8 },
  pill: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  pillActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  pillText: { color: '#aaa', fontSize: 13 },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  addButton: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  addButtonText: { color: '#6C63FF', fontSize: 15, fontWeight: '600' },
  submitButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
