import React, { useState } from 'react';
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
import { logWorkout, WorkoutProgressionItem } from '../../services/api';
import useAuthStore from '../../store/useAuthStore';
import useWorkoutSessionStore from '../../store/useWorkoutSessionStore';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      '#0D0E12',
  surface: '#15171D',
  accent:  '#E8522A',
  warm:    '#F5F0E8',
  muted:   '#52576B',
  divider: '#1E2028',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message ?? ''}`);
  else Alert.alert(title, message ?? '');
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WorkoutBuilderProps {
  onSubmit: (progressions: WorkoutProgressionItem[]) => void;
  onBack: () => void;
}

export default function WorkoutBuilder({ onSubmit, onBack }: WorkoutBuilderProps) {
  const [loading, setLoading] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(getLocalDateStr());
  const token = useAuthStore((s) => s.token);

  const {
    selectedExercises,
    suggestedWeights,
    notes,
    setNotes,
    addSet,
    removeSet,
    updateSet,
    removeExercise,
    updateRecentlyUsed,
  } = useWorkoutSessionStore();

  async function handleSubmit() {
    if (!token) return;

    if (selectedExercises.length === 0) {
      showAlert('No exercises', 'Add at least one exercise.');
      return;
    }

    for (const se of selectedExercises) {
      for (const s of se.sets) {
        if (!s.weight || !s.reps) {
          showAlert(
            'Incomplete sets',
            `Fill in weight and reps for all sets in "${se.exercise.name}".`,
          );
          return;
        }
        if (s.rpe && (parseInt(s.rpe, 10) < 1 || parseInt(s.rpe, 10) > 10)) {
          showAlert('Invalid RPE', 'RPE must be between 1 and 10.');
          return;
        }
      }
    }

    const allSets = selectedExercises.flatMap((se) =>
      se.sets.map((s) => ({
        exercise_id: se.exercise.id,
        set_number:  s.set_number,
        weight:      parseFloat(s.weight),
        reps:        parseInt(s.reps, 10),
        ...(s.rpe ? { rpe: parseInt(s.rpe, 10) } : {}),
      })),
    );

    setLoading(true);
    try {
      const response = await logWorkout(token, {
        date:  workoutDate || getLocalDateStr(),
        notes: notes || undefined,
        sets:  allSets,
      });

      // Persist recently used exercise IDs
      const loggedIds = selectedExercises.map((se) => se.exercise.id);
      updateRecentlyUsed(loggedIds);

      onSubmit(response.progressions ?? []);
    } catch (err: any) {
      showAlert('Error', err.message ?? 'Failed to log workout.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Add More</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Sets</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Date input */}
      <TextInput
        style={styles.notesInput}
        placeholder="Date (YYYY-MM-DD)"
        placeholderTextColor="#555"
        value={workoutDate}
        onChangeText={setWorkoutDate}
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
      />

      {/* Notes input */}
      <TextInput
        style={styles.notesInput}
        placeholder="Session notes (optional)"
        placeholderTextColor="#555"
        value={notes}
        onChangeText={setNotes}
      />

      {/* Exercise Blocks */}
      {selectedExercises.map((se) => (
        <View key={se.exercise.id} style={styles.exBlock}>
          {/* Exercise header */}
          <View style={styles.exBlockHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.exBlockName}>{se.exercise.name}</Text>
              <Text style={styles.exBlockMeta}>
                {se.exercise.muscle_group} · {se.exercise.equipment}
              </Text>
              {suggestedWeights[se.exercise.id] != null && (
                <Text style={styles.suggestionHint}>
                  💡 Suggested: {suggestedWeights[se.exercise.id]} lbs
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => removeExercise(se.exercise.id)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Column headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 0.4 }]}>SET</Text>
            <Text style={styles.tableCell}>WEIGHT (lbs)</Text>
            <Text style={styles.tableCell}>REPS</Text>
            <Text style={[styles.tableCell, { flex: 0.7 }]}>RPE</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Set rows */}
          {se.sets.map((s, idx) => (
            <View key={idx} style={styles.setRow}>
              <Text style={[styles.setNum, { flex: 0.4 }]}>{s.set_number}</Text>
              <TextInput
                style={styles.setInput}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor="#444"
                value={s.weight}
                onChangeText={(v) => updateSet(se.exercise.id, idx, 'weight', v)}
              />
              <TextInput
                style={styles.setInput}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor="#444"
                value={s.reps}
                onChangeText={(v) => updateSet(se.exercise.id, idx, 'reps', v)}
              />
              <TextInput
                style={[styles.setInput, { flex: 0.7 }]}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor="#444"
                value={s.rpe}
                maxLength={2}
                onChangeText={(v) => updateSet(se.exercise.id, idx, 'rpe', v)}
              />
              <TouchableOpacity
                onPress={() => removeSet(se.exercise.id, idx)}
                style={styles.removeSetBtn}
              >
                <Text style={styles.removeSetIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addSetBtn}
            onPress={() => addSet(se.exercise.id)}
          >
            <Text style={styles.addSetBtnText}>+ Add Set</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Submit */}
      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={C.warm} />
        ) : (
          <Text style={styles.submitText}>Save Workout →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 22, paddingBottom: 60 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.warm },
  backBtn:     { paddingVertical: 4 },
  backBtnText: { color: C.accent, fontSize: 14, fontWeight: '600' },

  notesInput: {
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 13,
    color: C.warm,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.divider,
    marginBottom: 16,
  },

  exBlock: {
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    borderWidth: 1,
    borderColor: C.divider,
  },
  exBlockHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  exBlockName:   { color: C.warm, fontSize: 16, fontWeight: '700' },
  exBlockMeta:   { color: C.muted, fontSize: 12, marginTop: 2 },
  suggestionHint: { color: C.accent, fontSize: 12, marginTop: 6, fontWeight: '600' },
  removeBtn:     { paddingLeft: 8 },
  removeBtnText: { color: C.muted, fontSize: 18 },

  tableHeader: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 2 },
  tableCell: {
    flex: 1,
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  setRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  setNum:  { flex: 0.4, color: C.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  setInput: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    color: C.warm,
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: C.divider,
    fontWeight: '600',
  },
  removeSetBtn: { width: 28, alignItems: 'center' },
  removeSetIcon: { color: C.muted, fontSize: 14 },

  addSetBtn: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.divider,
  },
  addSetBtnText: { color: C.accent, fontSize: 14, fontWeight: '600' },

  submitButton: {
    backgroundColor: C.accent,
    borderRadius: 8,
    padding: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: C.warm, fontSize: 16, fontWeight: '700' },
});
