import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../store/useAuthStore';
import {
  getExercises,
  getWorkouts,
  getProgression,
  getRecommendation,
  ExerciseResponse,
  WorkoutResponse,
  ProgressionResponse,
  RecommendationResponse,
} from '../services/api';

// ─── Design tokens ────────────────────────────────────────────────────────────

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

// ─── Body-part grouping ───────────────────────────────────────────────────────

/** Maps each backend muscle_group string (Title-case) to a UI tab category. */
const MUSCLE_TO_BODY_PART: Record<string, string> = {
  Chest:     'Chest',
  Back:      'Back',
  Legs:      'Legs',
  Shoulders: 'Shoulders',
  Biceps:    'Arms',
  Triceps:   'Arms',
  Core:      'Core',
};

/** Canonical display order of body-part tabs. */
const BODY_PART_ORDER = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

function bodyPartFor(muscleGroup: string): string {
  return MUSCLE_TO_BODY_PART[muscleGroup] ?? 'Other';
}

// ─── Summary stat derived from workouts ───────────────────────────────────────

function deriveSummary(workouts: WorkoutResponse[], exercises: ExerciseResponse[]) {
  const totalWorkouts = workouts.length;

  const sorted = [...workouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const lastDate = sorted.length
    ? new Date(sorted[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const exMap: Record<number, string> = {};
  exercises.forEach((e) => { exMap[e.id] = e.name; });

  // Most improved: exercise whose volume gained most from first to last logged set
  const volumeByEx: Record<number, number[]> = {};
  for (const w of sorted.slice().reverse()) {
    for (const s of w.sets ?? []) {
      if (!volumeByEx[s.exercise_id]) volumeByEx[s.exercise_id] = [];
      volumeByEx[s.exercise_id].push(s.weight * s.reps);
    }
  }
  let mostImproved = '';
  let bestGain = 0;
  for (const [idStr, vols] of Object.entries(volumeByEx)) {
    if (vols.length < 2) continue;
    const gain = vols[vols.length - 1] - vols[0];
    if (gain > bestGain) {
      bestGain = gain;
      mostImproved = exMap[Number(idStr)] ?? '';
    }
  }

  return { totalWorkouts, lastDate, mostImproved };
}

// ─── Trend bar (sparkline) ────────────────────────────────────────────────────

function TrendBar({ sets }: { sets: { weight: number; reps: number }[] }) {
  if (sets.length === 0) return null;
  const vols = sets.map((s) => s.weight * s.reps);
  const maxVol = Math.max(...vols, 1);
  return (
    <View style={bar.wrap}>
      {vols.map((v, i) => {
        const pct = v / maxVol;
        const isLast = i === vols.length - 1;
        return (
          <View key={i} style={bar.colWrap}>
            <View
              style={[
                bar.col,
                {
                  height: Math.max(6, pct * 56),
                  backgroundColor: isLast ? C.accent : C.muted,
                  opacity: isLast ? 1 : 0.35 + pct * 0.35,
                },
              ]}
            />
            <Text style={bar.lbl}>{i + 1}</Text>
          </View>
        );
      })}
    </View>
  );
}

const bar = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 12 },
  colWrap: { alignItems: 'center', flex: 1 },
  col:     { width: '100%', borderRadius: 2, minHeight: 6 },
  lbl:     { color: C.muted, fontSize: 9, marginTop: 3 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressionDashboard() {
  const token = useAuthStore((s) => s.token);

  const [exercises, setExercises]     = useState<ExerciseResponse[]>([]);
  const [workouts, setWorkouts]       = useState<WorkoutResponse[]>([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('');
  const [selected, setSelected]       = useState<ExerciseResponse | null>(null);
  const [progression, setProgression] = useState<ProgressionResponse | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [loadingInit, setLoadingInit]     = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [fetchError, setFetchError]       = useState<string | null>(null);

  // Reload when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoadingInit(true);
      Promise.all([getExercises(token), getWorkouts(token)])
        .then(([exs, wkts]) => {
          setExercises(exs);
          setWorkouts(wkts);
          // Auto-select first body part that has workout data
          const usedIds = new Set(wkts.flatMap((w) => (w.sets ?? []).map((s) => s.exercise_id)));
          const firstPart = BODY_PART_ORDER.find((part) =>
            exs.some((e) => bodyPartFor(e.muscle_group) === part && usedIds.has(e.id)),
          ) ?? '';
          setSelectedBodyPart((prev) => {
            // Keep current if it still has data; otherwise switch to firstPart
            const stillValid = prev !== '' && exs.some(
              (e) => bodyPartFor(e.muscle_group) === prev && usedIds.has(e.id),
            );
            return stillValid ? prev : firstPart;
          });
          setFetchError(null);
        })
        .catch(() => setFetchError('Could not reach backend. Make sure the server is running on port 8000.'))
        .finally(() => setLoadingInit(false));
    }, [token]),
  );

  // Load progression + recommendation when exercise changes
  useEffect(() => {
    if (!token || !selected) return;
    setLoadingDetail(true);
    setProgression(null);
    setRecommendation(null);
    Promise.all([
      getProgression(token, selected.id),
      getRecommendation(token, selected.id),
    ])
      .then(([prog, rec]) => { setProgression(prog); setRecommendation(rec); })
      .catch(() => {
        if (Platform.OS === 'web') window.alert('Could not load progression data.');
        else Alert.alert('Error', 'Could not load progression data.');
      })
      .finally(() => setLoadingDetail(false));
  }, [token, selected]);

  function trendColor(trend: string) {
    if (trend === 'improving') return C.positive;
    if (trend === 'regressing') return C.negative;
    return '#F59E0B';
  }

  // ── Derived: exercise ids that have logged data ──
  const usedIds = useMemo(
    () => new Set(workouts.flatMap((w) => (w.sets ?? []).map((s) => s.exercise_id))),
    [workouts],
  );

  // ── Derived: which body-part tabs have data ──
  const availableBodyParts = useMemo(
    () => BODY_PART_ORDER.filter((part) =>
      exercises.some((e) => bodyPartFor(e.muscle_group) === part && usedIds.has(e.id)),
    ),
    [exercises, usedIds],
  );

  // ── Derived: exercises for the selected body part (filtered to those with data) ──
  const exercisesForPart = useMemo(
    () => exercises.filter(
      (e) => bodyPartFor(e.muscle_group) === selectedBodyPart && usedIds.has(e.id),
    ),
    [exercises, selectedBodyPart, usedIds],
  );

  if (loadingInit) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Backend Unreachable</Text>
        <Text style={styles.errorBody}>{fetchError}</Text>
      </View>
    );
  }

  const summary = deriveSummary(workouts, exercises);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Progress.</Text>

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.totalWorkouts}</Text>
          <Text style={styles.summaryLabel}>Workouts</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryItemCenter]}>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {summary.mostImproved || '—'}
          </Text>
          <Text style={styles.summaryLabel}>Most Improved</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.lastDate ?? '—'}</Text>
          <Text style={styles.summaryLabel}>Last Session</Text>
        </View>
      </View>

      {/* ── Body-part tab grid ─────────────────────────────────────────────── */}
      {availableBodyParts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No workouts logged yet</Text>
          <Text style={styles.emptyBody}>
            Complete a session to see your progress here.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Body Part</Text>
          <View style={styles.bodyPartGrid}>
            {availableBodyParts.map((part) => (
              <TouchableOpacity
                key={part}
                style={[styles.bodyPartTab, selectedBodyPart === part && styles.bodyPartTabActive]}
                onPress={() => { setSelectedBodyPart(part); setSelected(null); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.bodyPartTabText, selectedBodyPart === part && styles.bodyPartTabTextActive]}>
                  {part}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Exercise list for selected body part ───────────────────────── */}
          {selectedBodyPart !== '' && (
            <>
              <Text style={styles.sectionLabel}>{selectedBodyPart}</Text>
              {exercisesForPart.map((ex) => {
                const isActive = selected?.id === ex.id;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.exRow, isActive && styles.exRowActive]}
                    onPress={() => setSelected(isActive ? null : ex)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.exRowName, isActive && { color: C.accent }]}>
                        {ex.name}
                      </Text>
                      {ex.equipment !== 'none' && (
                        <Text style={styles.exRowMeta}>{ex.equipment}</Text>
                      )}
                    </View>
                    <Text style={styles.exRowChevron}>{isActive ? '▼' : '›'}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* ── Exercise detail ──────────────────────────────────────────────── */}
          {loadingDetail ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="small" color={C.accent} />
            </View>
          ) : selected && progression && recommendation ? (
            <>
              {/* Trend card */}
              <View style={[styles.card, { marginTop: 20 }]}>
                <Text style={styles.cardLabel}>Performance Trend</Text>
                <View style={styles.trendRow}>
                  <Text style={[styles.trendWord, { color: trendColor(progression.trend) }]}>
                    {progression.trend.toUpperCase()}
                  </Text>
                  <View style={styles.trendBadges}>
                    {progression.plateau_detected && (
                      <View style={[styles.badge, { borderColor: '#F59E0B' }]}>
                        <Text style={[styles.badgeText, { color: '#F59E0B' }]}>PLATEAU</Text>
                      </View>
                    )}
                    {progression.is_pr && (
                      <View style={[styles.badge, { borderColor: C.positive }]}>
                        <Text style={[styles.badgeText, { color: C.positive }]}>PR</Text>
                      </View>
                    )}
                  </View>
                </View>
                {progression.last_outcome && (
                  <Text style={styles.outcomeText}>
                    Last outcome:{' '}
                    <Text style={{ color: progression.last_outcome === 'success' ? C.positive : progression.last_outcome === 'failure' ? C.negative : '#F59E0B' }}>
                      {progression.last_outcome}
                    </Text>
                  </Text>
                )}
                {progression.recent_sets.length > 0 && (
                  <>
                    <Text style={[styles.cardLabel, { marginTop: 16 }]}>Volume Trend</Text>
                    <TrendBar sets={progression.recent_sets} />
                  </>
                )}
              </View>

              {/* Recent sets */}
              {progression.recent_sets.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Recent Sets</Text>
                  {progression.recent_sets.map((s, i) => {
                    const isLast = i === progression.recent_sets.length - 1;
                    return (
                      <View key={i} style={styles.setRow}>
                        <Text style={[styles.setIdx, isLast && { color: C.accent }]}>#{i + 1}</Text>
                        <Text style={styles.setWeight}>{s.weight} lbs</Text>
                        <Text style={styles.setReps}>× {s.reps}</Text>
                        <Text style={styles.setVol}>{(s.weight * s.reps).toLocaleString()} vol</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Recommendation */}
              <View style={[styles.card, recommendation.is_deload ? styles.deloadCard : styles.targetCard]}>
                <Text style={styles.cardLabel}>
                  {recommendation.is_deload ? 'Deload Recommended' : 'Next Session Target'}
                </Text>
                <View style={styles.recNumRow}>
                  <Text style={styles.recWeight}>{recommendation.next_weight}</Text>
                  <Text style={styles.recUnit}>lbs</Text>
                  <Text style={styles.recSep}>×</Text>
                  <Text style={styles.recReps}>{recommendation.target_reps}</Text>
                  <Text style={styles.recUnit}>reps</Text>
                </View>
                <Text style={styles.recReasoning}>{recommendation.reasoning}</Text>
              </View>
            </>
          ) : selected && !loadingDetail ? (
            <View style={[styles.card, { marginTop: 20, alignItems: 'center' }]}>
              <Text style={styles.emptyTitle}>No progression data available</Text>
              <Text style={styles.emptyBody}>Log more sets for this exercise to see progression.</Text>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 22, paddingBottom: 60 },

  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingText: { color: C.muted, marginTop: 12, fontSize: 13 },
  errorTitle:  { color: C.negative, fontSize: 15, fontWeight: '600' },
  errorBody:   { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },

  pageTitle: { fontSize: 36, fontWeight: '900', color: C.warm, letterSpacing: -1, marginBottom: 24 },

  // Summary strip
  summaryRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 4, padding: 16, marginBottom: 28,
    borderWidth: 1, borderColor: C.divider,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemCenter: {
    flex: 2, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: C.divider, paddingHorizontal: 8,
  },
  summaryValue: { fontSize: 15, fontWeight: '800', color: C.warm, letterSpacing: -0.3 },
  summaryLabel: { fontSize: 9, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },

  // Section label
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },

  // Body-part tabs
  bodyPartGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  bodyPartTab: {
    backgroundColor: C.surface, borderRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: C.divider,
  },
  bodyPartTabActive: { backgroundColor: C.accent, borderColor: C.accent },
  bodyPartTabText: { color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  bodyPartTabTextActive: { color: C.warm },

  // Exercise rows
  exRow: {
    backgroundColor: C.surface, borderRadius: 4,
    borderWidth: 1, borderColor: C.divider,
    padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  exRowActive: { borderColor: C.accent, backgroundColor: '#1A1C24' },
  exRowName: { fontSize: 14, fontWeight: '700', color: C.warm },
  exRowMeta: { fontSize: 11, color: C.muted, marginTop: 3 },
  exRowChevron: { color: C.muted, fontSize: 18 },

  detailLoading: { marginTop: 48, alignItems: 'center' },

  // Cards
  card: {
    backgroundColor: C.surface, borderRadius: 4,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.divider,
  },
  deloadCard: { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  targetCard: { borderLeftWidth: 3, borderLeftColor: C.positive },
  cardLabel:  { fontSize: 10, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },

  // Trend
  trendRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  trendWord:   { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  trendBadges: { flexDirection: 'row', gap: 6 },
  badge:       { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText:   { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  outcomeText: { fontSize: 12, color: C.muted, marginTop: 2 },

  // Sets
  setRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.divider },
  setIdx:    { width: 28, fontSize: 12, fontWeight: '700', color: C.muted },
  setWeight: { flex: 1, fontSize: 14, fontWeight: '700', color: C.warm },
  setReps:   { flex: 1, fontSize: 14, color: C.warm },
  setVol:    { fontSize: 11, color: C.muted, fontWeight: '600' },

  // Recommendation
  recNumRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 10 },
  recWeight:   { fontSize: 44, fontWeight: '900', color: C.warm, letterSpacing: -2 },
  recSep:      { fontSize: 20, color: C.muted, marginHorizontal: 4 },
  recReps:     { fontSize: 32, fontWeight: '800', color: C.warm, letterSpacing: -1 },
  recUnit:     { fontSize: 14, color: C.muted, fontWeight: '600', paddingBottom: 4 },
  recReasoning:{ fontSize: 13, color: C.muted, lineHeight: 20 },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: C.warm, marginBottom: 8 },
  emptyBody:  { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },
});
