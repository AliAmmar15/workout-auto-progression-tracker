import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../store/useAuthStore';
import {
  getWorkouts,
  getExercises,
  WorkoutResponse,
  ExerciseResponse,
} from '../services/api';

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

export default function WorkoutHistoryScreen() {
  const token = useAuthStore((s) => s.token);
  const [workouts, setWorkouts]     = useState<WorkoutResponse[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<number, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [fetchError, setFetchError]   = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      // Fetch workouts + exercise list in parallel
      const [data, exercises] = await Promise.all([
        getWorkouts(token),
        getExercises(token),
      ]);

      // Build exercise id → name map
      const exMap: Record<number, string> = {};
      exercises.forEach((e: ExerciseResponse) => { exMap[e.id] = e.name; });
      setExerciseMap(exMap);
      setWorkouts(data);
      setFetchError(null);
    } catch {
      setFetchError('Could not reach backend. Make sure the server is running on port 8000.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => { loadAll(); }, [loadAll]),
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function renderWorkout({ item }: { item: WorkoutResponse }) {
    const grouped = new Map<number, typeof item.sets>();
    for (const s of (item.sets ?? [])) {
      if (!grouped.has(s.exercise_id)) grouped.set(s.exercise_id, []);
      grouped.get(s.exercise_id)!.push(s);
    }
    const totalSets   = item.sets?.length ?? 0;
    const totalVolume = item.sets?.reduce((acc, s) => acc + s.weight * s.reps, 0) ?? 0;
    const isExpanded  = expandedIds.has(item.id);

    return (
      <View style={styles.card}>
        {/* ── Tappable header ── */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleExpanded(item.id)}
          activeOpacity={0.75}
        >
          <View style={styles.headerTop}>
            <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
            <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
          {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryBadge}>{grouped.size} exercise{grouped.size !== 1 ? 's' : ''}</Text>
            <Text style={styles.summaryBadge}>{totalSets} set{totalSets !== 1 ? 's' : ''}</Text>
            <Text style={styles.summaryBadge}>{totalVolume.toLocaleString()} vol</Text>
          </View>
        </TouchableOpacity>

        {/* ── Expandable body ── */}
        {isExpanded && (
          <View style={styles.cardBody}>
            {Array.from(grouped.entries()).map(([exId, sets]) => {
              const exName = exerciseMap[exId] ?? `Exercise #${exId}`;
              return (
                <View key={exId} style={styles.exBlock}>
                  <Text style={styles.exName}>{exName}</Text>
                  {sets.map((s) => (
                    <View key={s.id} style={styles.setRow}>
                      <Text style={styles.setNum}>Set {s.set_number}</Text>
                      <Text style={styles.setDetail}>
                        {s.weight} lbs × {s.reps} reps{s.rpe ? `  ·  RPE ${s.rpe}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading history…</Text>
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>History.</Text>

      {workouts.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No workouts yet</Text>
          <Text style={styles.emptySubtitle}>Log your first workout to see it here.</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderWorkout}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadAll(); }}
              tintColor={C.accent}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingTop: 20 },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingText: { color: C.muted, marginTop: 12, fontSize: 13 },
  errorTitle:  { color: C.negative, fontSize: 15, fontWeight: '600' },
  errorBody:   { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },

  title:       { fontSize: 36, fontWeight: '900', color: C.warm, paddingHorizontal: 22, marginTop: 8, marginBottom: 16, letterSpacing: -1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 60 },

  // Card
  card:       { backgroundColor: C.surface, borderRadius: 4, marginBottom: 10, borderWidth: 1, borderColor: C.divider, overflow: 'hidden' },
  cardHeader: { padding: 16 },
  headerTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardDate:   { fontSize: 16, fontWeight: '700', color: C.warm },
  chevron:    { fontSize: 11, color: C.muted },
  cardNotes:  { fontSize: 12, color: C.muted, marginBottom: 8, fontStyle: 'italic' },

  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  summaryBadge: {
    fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 0.8,
    backgroundColor: C.bg, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3,
  },

  // Expanded body
  cardBody: { borderTopWidth: 1, borderTopColor: C.divider, paddingHorizontal: 16, paddingBottom: 12 },
  exBlock:  { paddingTop: 12, marginBottom: 4 },
  exName:   { fontSize: 13, fontWeight: '700', color: C.accent, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },

  setRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.divider },
  setNum:    { fontSize: 12, color: C.muted, fontWeight: '600', width: 48 },
  setDetail: { fontSize: 13, color: C.warm },

  emptyTitle:    { fontSize: 18, color: C.warm, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: C.muted },
});
