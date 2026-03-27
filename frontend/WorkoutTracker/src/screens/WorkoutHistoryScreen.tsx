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
  getExerciseRecommendation,
  WorkoutResponse,
  ExerciseResponse,
  RecommendationResponse,
} from '../services/api';

const ACTION_COLORS: Record<string, string> = {
  increase: '#2ecc71',
  maintain: '#f39c12',
  decrease: '#e74c3c',
  deload:   '#9b59b6',
};

export default function WorkoutHistoryScreen() {
  const token = useAuthStore((s) => s.token);
  const [workouts, setWorkouts] = useState<WorkoutResponse[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<number, string>>({});
  const [recommendations, setRecommendations] = useState<Record<number, RecommendationResponse>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

      // Collect unique exercise IDs across all workouts
      const uniqueIds = Array.from(
        new Set(data.flatMap((w: WorkoutResponse) => w.sets?.map((s) => s.exercise_id) ?? [])),
      );

      // Fetch recommendations in parallel (ignore individual failures)
      const results = await Promise.allSettled(
        uniqueIds.map((id) =>
          getExerciseRecommendation(token, id).then((r) => ({ id, r })),
        ),
      );
      const recs: Record<number, RecommendationResponse> = {};
      for (const res of results) {
        if (res.status === 'fulfilled') recs[res.value.id] = res.value.r;
      }
      setRecommendations(recs);
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

  function renderWorkout({ item }: { item: WorkoutResponse }) {
    // Group sets by exercise_id (preserve insertion order)
    const grouped = new Map<number, typeof item.sets>();
    for (const s of (item.sets ?? [])) {
      if (!grouped.has(s.exercise_id)) grouped.set(s.exercise_id, []);
      grouped.get(s.exercise_id)!.push(s);
    }

    const totalSets = item.sets?.length ?? 0;
    const totalVolume = item.sets?.reduce((acc, s) => acc + s.weight * s.reps, 0) ?? 0;

    return (
      <View style={styles.card}>
        {/* ── Card header ── */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
          {item.notes ? <Text style={styles.cardNotes}>📝 {item.notes}</Text> : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryBadge}>{grouped.size} exercise{grouped.size !== 1 ? 's' : ''}</Text>
            <Text style={styles.summaryBadge}>{totalSets} set{totalSets !== 1 ? 's' : ''}</Text>
            <Text style={styles.summaryBadge}>{totalVolume.toLocaleString()} lbs vol</Text>
          </View>
        </View>

        {/* ── Per-exercise blocks ── */}
        {Array.from(grouped.entries()).map(([exId, sets]) => {
          const exName = exerciseMap[exId] ?? `Exercise #${exId}`;
          const rec = recommendations[exId];

          return (
            <View key={exId} style={styles.exBlock}>
              <Text style={styles.exName}>{exName}</Text>

              {/* Sets */}
              {sets.map((s) => (
                <View key={s.id} style={styles.setRow}>
                  <Text style={styles.setNum}>Set {s.set_number}</Text>
                  <Text style={styles.setDetail}>
                    {s.weight} lbs × {s.reps} reps{s.rpe ? `  RPE ${s.rpe}` : ''}
                  </Text>
                </View>
              ))}

              {/* Recommendation */}
              {rec && (
                <View style={[styles.recRow, { borderColor: rec.is_deload ? '#9b59b6' : '#6C63FF' }]}>
                  <Text style={styles.recIcon}>{rec.is_deload ? '🔄' : '💡'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recLabel, { color: rec.is_deload ? '#9b59b6' : '#6C63FF' }]}>
                      {rec.is_deload ? 'Deload recommended' : 'Next session target'}
                    </Text>
                    <Text style={styles.recDetail}>
                      {rec.recommended_weight} lbs × {rec.recommended_reps} reps
                    </Text>
                    <Text style={styles.recReason}>{rec.reasoning}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={{ color: '#888', marginTop: 12, fontSize: 13 }}>Loading history…</Text>
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
    <View style={styles.container}>
      <Text style={styles.title}>Workout History</Text>

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
              tintColor="#6C63FF"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A', paddingTop: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F1A' },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', paddingHorizontal: 20, marginBottom: 12 },
  listContent: { padding: 16, paddingBottom: 60 },

  card: {
    backgroundColor: '#14142A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  cardHeader: { marginBottom: 14 },
  cardDate: { fontSize: 17, fontWeight: '700', color: '#fff' },
  cardNotes: { fontSize: 13, color: '#888', marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  summaryBadge: {
    fontSize: 11, fontWeight: '600', color: '#6C63FF',
    backgroundColor: '#6C63FF22', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },

  exBlock: {
    borderTopWidth: 1, borderTopColor: '#2E2E4A',
    paddingTop: 12, marginTop: 4, marginBottom: 8,
  },
  exName: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 8 },

  setRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  setNum: { fontSize: 13, color: '#6C63FF', fontWeight: '600' },
  setDetail: { fontSize: 13, color: '#ccc' },

  recRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 10, padding: 10, borderRadius: 10,
    borderWidth: 1, backgroundColor: '#0F0F1A',
  },
  recIcon: { fontSize: 18, marginTop: 1 },
  recLabel: { fontSize: 12, fontWeight: '700' },
  recDetail: { fontSize: 13, color: '#fff', fontWeight: '600', marginTop: 2 },
  recReason: { fontSize: 12, color: '#888', marginTop: 2 },

  emptyTitle: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#555' },
});
