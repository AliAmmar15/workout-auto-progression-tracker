import React, { useState, useEffect, useMemo } from 'react';
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
import { getExercises, logWorkout, createExercise, getExerciseRecommendation, ExerciseResponse, WorkoutProgressionItem } from '../services/api';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      '#0D0E12',
  surface: '#15171D',
  accent:  '#E8522A',
  warm:    '#F5F0E8',
  muted:   '#52576B',
  divider: '#1E2028',
  positive:'#3DBE7A',
  negative:'#E84A4A',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'muscle' | 'exercises' | 'sets' | 'results';

interface SetEntry {
  set_number: number;
  weight: string;
  reps: string;
}

interface SelectedExercise {
  exercise: ExerciseResponse;
  sets: SetEntry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MUSCLE_GROUPS = [
  { label: 'Chest',     emoji: '🫁', color: '#e74c3c' },
  { label: 'Back',      emoji: '🔼', color: '#3498db' },
  { label: 'Legs',      emoji: '🦵', color: '#2ecc71' },
  { label: 'Shoulders', emoji: '🏔️', color: '#9b59b6' },
  { label: 'Arms',      emoji: '💪', color: '#e67e22' },
  { label: 'Core',      emoji: '🎯', color: '#1abc9c' },
  { label: 'Full Body', emoji: '🏋️', color: '#f39c12' },
  { label: 'Cardio',    emoji: '🏃', color: '#e91e63' },
];

// Maps UI label → DB muscle_group values
const MUSCLE_GROUP_MAP: Record<string, string[]> = {
  Chest:       ['Chest'],
  Back:        ['Back'],
  Legs:        ['Legs'],
  Shoulders:   ['Shoulders'],
  Arms:        ['Biceps', 'Triceps', 'Arms'],
  Core:        ['Core'],
  'Full Body': ['Full Body'],
  Cardio:      ['Cardio'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message || ''}`);
  else Alert.alert(title, message || '');
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WorkoutLogScreen() {
  const token = useAuthStore((s) => s.token);

  const [step, setStep] = useState<Step>('muscle');
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [allExercises, setAllExercises] = useState<ExerciseResponse[]>([]);
  const [search, setSearch] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [notes, setNotes] = useState('');
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progressions, setProgressions] = useState<WorkoutProgressionItem[]>([]);
  const [suggestedWeights, setSuggestedWeights] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!token) return;
    getExercises(token)
      .then(setAllExercises)
      .catch(() => setFetchError('Could not reach backend. Make sure the server is running.'))
      .finally(() => setFetching(false));
  }, [token]);

  // Exercises for selected muscle group
  const muscleExercises = useMemo(() => {
    const groups = MUSCLE_GROUP_MAP[selectedMuscle] ?? [selectedMuscle];
    return allExercises.filter((e) =>
      groups.some((g) => e.muscle_group.toLowerCase() === g.toLowerCase()),
    );
  }, [allExercises, selectedMuscle]);

  // Quick-match filtered list as user types
  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return muscleExercises;
    return muscleExercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [muscleExercises, search]);

  const isSelected = (id: number) => selectedExercises.some((se) => se.exercise.id === id);

  function toggleExercise(ex: ExerciseResponse) {
    setSelectedExercises((prev) => {
      if (prev.some((se) => se.exercise.id === ex.id)) {
        return prev.filter((se) => se.exercise.id !== ex.id);
      }
      return [...prev, { exercise: ex, sets: [{ set_number: 1, weight: '', reps: '' }] }];
    });
  }

  async function handleCreateExercise() {
    const name = search.trim();
    if (!name || !token) return;
    setCreating(true);
    try {
      const dbGroup = MUSCLE_GROUP_MAP[selectedMuscle]?.[0] ?? selectedMuscle ?? 'Other';
      const created = await createExercise(token, { name, muscle_group: dbGroup, equipment: 'Other' });
      setAllExercises((prev) => [...prev, created]);
      toggleExercise(created);
      setSearch('');
    } catch (err: any) {
      showAlert('Error', err.message ?? 'Could not create exercise.');
    } finally {
      setCreating(false);
    }
  }

  function addSet(exerciseId: number) {
    setSelectedExercises((prev) =>
      prev.map((se) =>
        se.exercise.id === exerciseId
          ? { ...se, sets: [...se.sets, { set_number: se.sets.length + 1, weight: '', reps: '' }] }
          : se,
      ),
    );
  }

  function removeSet(exerciseId: number, idx: number) {
    setSelectedExercises((prev) =>
      prev.map((se) => {
        if (se.exercise.id !== exerciseId) return se;
        const newSets = se.sets
          .filter((_, i) => i !== idx)
          .map((s, i) => ({ ...s, set_number: i + 1 }));
        return { ...se, sets: newSets };
      }),
    );
  }

  function updateSet(exerciseId: number, idx: number, field: 'weight' | 'reps', value: string) {
    setSelectedExercises((prev) =>
      prev.map((se) =>
        se.exercise.id === exerciseId
          ? { ...se, sets: se.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s)) }
          : se,
      ),
    );
  }

  function removeExercise(exerciseId: number) {
    setSelectedExercises((prev) => prev.filter((se) => se.exercise.id !== exerciseId));
  }

  async function goToSets() {
    if (!token) return;
    // Fetch recommendations for all selected exercises in parallel (silently ignore failures)
    const results = await Promise.allSettled(
      selectedExercises.map((se) =>
        getExerciseRecommendation(token, se.exercise.id).then((r) => ({ id: se.exercise.id, weight: r.next_weight })),
      ),
    );
    const weights: Record<number, number> = {};
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.weight > 0) {
        weights[r.value.id] = r.value.weight;
      }
    }
    setSuggestedWeights(weights);
    setStep('sets');
  }

  async function handleSubmit() {
    if (!token) return;
    if (selectedExercises.length === 0) {
      showAlert('No exercises', 'Add at least one exercise.');
      return;
    }
    for (const se of selectedExercises) {
      for (const s of se.sets) {
        if (!s.weight || !s.reps) {
          showAlert('Incomplete', `Fill in weight and reps for all sets in "${se.exercise.name}".`);
          return;
        }
      }
    }

    const allSets = selectedExercises.flatMap((se) =>
      se.sets.map((s) => ({
        exercise_id: se.exercise.id,
        set_number: s.set_number,
        weight: parseFloat(s.weight),
        reps: parseInt(s.reps, 10),
      })),
    );

    setLoading(true);
    try {
      const response = await logWorkout(token, { date: getLocalDateStr(), notes: notes || undefined, sets: allSets });
      setProgressions(response.progressions ?? []);
      setStep('results');
    } catch (err: any) {
      showAlert('Error', err.message ?? 'Failed to log workout.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Loading / Error ───────────────────────────────────────────────────────

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

  // ─── Step 1: Pick Muscle Group ─────────────────────────────────────────────

  if (step === 'muscle') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>What are you{'\n'}training today?</Text>
        <Text style={styles.subtitle}>Pick a muscle group to get started</Text>
        <View style={styles.muscleGrid}>
          {MUSCLE_GROUPS.map((mg) => (
            <TouchableOpacity
              key={mg.label}
              style={[styles.muscleCard, { borderColor: mg.color }]}
              onPress={() => {
                setSelectedMuscle(mg.label);
                setSearch('');
                setStep('exercises');
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.muscleEmoji}>{mg.emoji}</Text>
              <Text style={[styles.muscleLabel, { color: mg.color }]}>{mg.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ─── Step 2: Pick Exercises ────────────────────────────────────────────────

  if (step === 'exercises') {
    const q = search.trim();
    const noResults = q.length > 0 && filteredExercises.length === 0;
    const showCreate = q.length > 1 && filteredExercises.length === 0;
    const selectedCount = selectedExercises.length;

    return (
      <View style={styles.container}>
        {/* Header row */}
        <View style={styles.stepHeader}>
          <TouchableOpacity onPress={() => setStep('muscle')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.stepTitle}>{selectedMuscle}</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search or type to create…"
            placeholderTextColor="#555"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="words"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: C.muted, fontSize: 18, paddingRight: 12 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130 }}>
          {/* Create custom exercise */}
          {showCreate && (
            <TouchableOpacity
              style={styles.createRow}
              onPress={handleCreateExercise}
              disabled={creating}
              activeOpacity={0.8}
            >
              {creating ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <>
                  <Text style={styles.createIcon}>＋</Text>
                  <View>
                    <Text style={styles.createName}>Create "{q}"</Text>
                    <Text style={styles.createMeta}>Custom · {selectedMuscle}</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Exercise list */}
          {filteredExercises.map((ex) => {
            const sel = isSelected(ex.id);
            return (
              <TouchableOpacity
                key={ex.id}
                style={[styles.exRow, sel && styles.exRowSelected]}
                onPress={() => toggleExercise(ex)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exName, sel && { color: '#fff' }]}>{ex.name}</Text>
                  <Text style={styles.exMeta}>{ex.muscle_group} · {ex.equipment}</Text>
                </View>
                <View style={[styles.checkCircle, sel && styles.checkCircleFilled]}>
                  <Text style={{ color: sel ? '#fff' : '#555', fontSize: 14, fontWeight: '700' }}>
                    {sel ? '✓' : '+'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {!noResults && filteredExercises.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🏋️</Text>
              <Text style={styles.emptyTitle}>No exercises yet</Text>
              <Text style={styles.emptySubtitle}>
                Type a name above to create your first {selectedMuscle} exercise
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Floating next bar */}
        {selectedCount > 0 && (
          <View style={styles.floatingBar}>
            <TouchableOpacity style={styles.floatingBtn} onPress={goToSets} activeOpacity={0.9}>
              <Text style={styles.floatingBtnText}>
                Log {selectedCount} Exercise{selectedCount > 1 ? 's' : ''} →
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ─── Step 4: Progression Results ──────────────────────────────────────────

  if (step === 'results') {
    const ACTION_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
      increase: { color: '#2ecc71', icon: '📈', label: 'Increase Weight' },
      maintain:  { color: '#f39c12', icon: '➡️', label: 'Maintain Weight'  },
      decrease:  { color: '#e74c3c', icon: '📉', label: 'Decrease Weight'  },
      deload:    { color: '#9b59b6', icon: '🔄', label: 'Deload'           },
    };

    function resetWorkout() {
      setStep('muscle');
      setSelectedMuscle('');
      setSelectedExercises([]);
      setSearch('');
      setNotes('');
      setProgressions([]);
      setSuggestedWeights({});
    }

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.resultsBanner}>
          <Text style={styles.resultsBannerTitle}>Saved.</Text>
          <Text style={styles.resultsBannerSub}>Here's your progression for next session</Text>
        </View>

        {progressions.length === 0 ? (
          <View style={styles.noProgressionWrap}>
            <Text style={styles.noProgressionText}>No progression data yet — log more sessions to unlock recommendations.</Text>
          </View>
        ) : (
          progressions.map((p) => {
            const cfg = ACTION_CONFIG[p.action] ?? ACTION_CONFIG['maintain'];
            return (
              <View key={p.exercise_id} style={[styles.progressionCard, { borderColor: cfg.color }]}>
                <View style={styles.progressionCardHeader}>
                  <Text style={styles.progressionIcon}>{cfg.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.progressionExName}>{p.exercise_name}</Text>
                    <Text style={[styles.progressionAction, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  {p.next_weight > 0 && (
                    <View style={[styles.weightBadge, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
                      <Text style={[styles.weightBadgeText, { color: cfg.color }]}>
                        {p.next_weight} lbs
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.progressionReasoning}>{p.reasoning}</Text>
              </View>
            );
          })
        )}

        <TouchableOpacity style={styles.doneButton} onPress={resetWorkout} activeOpacity={0.85}>
          <Text style={styles.doneButtonText}>Log Another Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Step 3: Log Sets ──────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.stepHeaderFlat}>
        <TouchableOpacity onPress={() => setStep('exercises')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Add More</Text>
        </TouchableOpacity>
        <Text style={styles.stepTitle}>Log Sets</Text>
        <View style={{ width: 80 }} />
      </View>

      <TextInput
        style={styles.notesInput}
        placeholder="Session notes (optional)"
        placeholderTextColor="#555"
        value={notes}
        onChangeText={setNotes}
      />

      {selectedExercises.map((se) => (
        <View key={se.exercise.id} style={styles.exBlock}>
          <View style={styles.exBlockHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.exBlockName}>{se.exercise.name}</Text>
              <Text style={styles.exBlockMeta}>
                {se.exercise.muscle_group} · {se.exercise.equipment}
              </Text>
              {suggestedWeights[se.exercise.id] != null && (
                <Text style={styles.suggestionHint}>
                  💡 Suggested next: {suggestedWeights[se.exercise.id]} lbs
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => removeExercise(se.exercise.id)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Column headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 0.4 }]}>SET</Text>
            <Text style={styles.tableCell}>WEIGHT (lbs)</Text>
            <Text style={styles.tableCell}>REPS</Text>
            <View style={{ width: 28 }} />
          </View>

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
              <TouchableOpacity
                onPress={() => removeSet(se.exercise.id, idx)}
                style={{ width: 28, alignItems: 'center' }}
              >
                <Text style={{ color: C.muted, fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(se.exercise.id)}>
            <Text style={styles.addSetBtnText}>+ Add Set</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color={C.warm} /> : <Text style={styles.submitText}>Save Workout →</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 22, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingText: { color: C.muted, marginTop: 12, fontSize: 13 },
  errorTitle: { color: C.negative, fontSize: 15, fontWeight: '600', marginTop: 12 },
  errorBody: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },

  // Step 1
  title: { fontSize: 36, fontWeight: '900', color: C.warm, lineHeight: 40, marginBottom: 6, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: C.muted, marginBottom: 32 },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  muscleCard: {
    width: '46.5%',
    backgroundColor: C.surface,
    borderRadius: 6,
    paddingVertical: 24,
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  muscleEmoji: { fontSize: 34, marginBottom: 8 },
  muscleLabel: { fontSize: 14, fontWeight: '700', color: C.warm },

  // Step 2
  stepHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
  },
  stepHeaderFlat: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18,
  },
  stepTitle: { fontSize: 18, fontWeight: '700', color: C.warm },
  backBtn: { paddingVertical: 4 },
  backBtnText: { color: C.accent, fontSize: 14, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 4, marginHorizontal: 16, marginBottom: 14,
    borderWidth: 1, borderColor: C.divider,
  },
  searchIcon: { paddingLeft: 12, fontSize: 16 },
  searchInput: { flex: 1, paddingHorizontal: 10, paddingVertical: 13, color: C.warm, fontSize: 15 },

  createRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface,
    borderRadius: 4, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.accent,
  },
  createIcon: { color: C.accent, fontSize: 22, fontWeight: '700' },
  createName: { color: C.accent, fontSize: 15, fontWeight: '700' },
  createMeta: { color: C.muted, fontSize: 12, marginTop: 2 },

  exRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 4, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.divider,
  },
  exRowSelected: { borderColor: C.accent, borderLeftWidth: 3 },
  exName: { color: C.warm, fontSize: 15, fontWeight: '600' },
  exMeta: { color: C.muted, fontSize: 12, marginTop: 3 },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.muted,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  checkCircleFilled: { backgroundColor: C.accent, borderColor: C.accent },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { color: C.muted, fontSize: 16, fontWeight: '600' },
  emptySubtitle: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },

  floatingBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 24, backgroundColor: C.bg,
    borderTopWidth: 1, borderTopColor: C.divider,
  },
  floatingBtn: { backgroundColor: C.accent, borderRadius: 4, padding: 16, alignItems: 'center' },
  floatingBtnText: { color: C.warm, fontSize: 16, fontWeight: '700' },

  // Step 3
  notesInput: {
    backgroundColor: C.surface, borderRadius: 4, padding: 13,
    color: C.warm, fontSize: 14, borderWidth: 1, borderColor: C.divider, marginBottom: 16,
  },
  exBlock: {
    backgroundColor: C.surface, borderRadius: 4, padding: 16,
    marginBottom: 14, borderLeftWidth: 3, borderLeftColor: C.accent,
    borderWidth: 1, borderColor: C.divider,
  },
  exBlockHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  exBlockName: { color: C.warm, fontSize: 16, fontWeight: '700' },
  exBlockMeta: { color: C.muted, fontSize: 12, marginTop: 2 },
  suggestionHint: { color: C.accent, fontSize: 12, marginTop: 4, fontWeight: '600' },
  removeBtn: { paddingLeft: 8 },
  removeBtnText: { color: C.muted, fontSize: 18 },

  tableHeader: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 2 },
  tableCell: { flex: 1, color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },

  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  setNum: { flex: 0.4, color: C.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  setInput: {
    flex: 1, backgroundColor: C.bg, borderRadius: 4,
    paddingVertical: 10, paddingHorizontal: 6,
    color: C.warm, fontSize: 16, textAlign: 'center',
    marginHorizontal: 4, borderWidth: 1, borderColor: C.divider, fontWeight: '600',
  },

  addSetBtn: {
    marginTop: 8, alignItems: 'center', paddingVertical: 10,
    borderRadius: 4, borderWidth: 1, borderColor: C.divider,
  },
  addSetBtnText: { color: C.accent, fontSize: 14, fontWeight: '600' },

  submitButton: { backgroundColor: C.accent, borderRadius: 4, padding: 17, alignItems: 'center', marginTop: 8 },
  submitText: { color: C.warm, fontSize: 16, fontWeight: '700' },

  // Step 4 – Results
  resultsBanner: { alignItems: 'flex-start', marginBottom: 32, marginTop: 8 },
  resultsBannerIcon: { fontSize: 40, marginBottom: 12 },
  resultsBannerTitle: { fontSize: 32, fontWeight: '900', color: C.warm, letterSpacing: -1 },
  resultsBannerSub: { fontSize: 13, color: C.muted, marginTop: 6 },

  progressionCard: {
    backgroundColor: C.surface, borderRadius: 4,
    padding: 16, marginBottom: 12, borderLeftWidth: 3,
    borderWidth: 1, borderColor: C.divider,
  },
  progressionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  progressionIcon: { fontSize: 28 },
  progressionExName: { color: C.warm, fontSize: 15, fontWeight: '700' },
  progressionAction: { fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 },
  weightBadge: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 4 },
  weightBadgeText: { fontSize: 14, fontWeight: '700' },
  progressionReasoning: { color: C.muted, fontSize: 13, lineHeight: 19 },

  noProgressionWrap: { alignItems: 'center', marginTop: 20, marginBottom: 28 },
  noProgressionText: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },

  doneButton: {
    borderRadius: 4, padding: 16, alignItems: 'center', marginTop: 8,
    borderWidth: 1, borderColor: C.accent,
  },
  doneButtonText: { color: C.accent, fontSize: 15, fontWeight: '700' },
});

