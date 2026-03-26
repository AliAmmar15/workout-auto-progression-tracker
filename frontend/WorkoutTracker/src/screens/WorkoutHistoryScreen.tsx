import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../store/useAuthStore';
import { getWorkouts, WorkoutResponse, WorkoutSetResponse } from '../services/api';

/**
 * WorkoutHistoryScreen — displays the authenticated user's past workouts.
 * Workouts are sorted most-recent first. Each card shows date, notes,
 * and the individual sets grouped under the workout.
 */
export default function WorkoutHistoryScreen() {
  const token = useAuthStore((s) => s.token);
  const [workouts, setWorkouts] = useState<WorkoutResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchWorkouts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getWorkouts(token);
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
    useCallback(() => {
      fetchWorkouts();
    }, [fetchWorkouts])
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function renderSet(set: WorkoutSetResponse) {
    return (
      <View key={set.id} style={styles.setRow}>
        <Text style={styles.setNum}>Set {set.set_number}</Text>
        <Text style={styles.setDetail}>
          {set.weight} lbs × {set.reps} reps
          {set.rpe ? `  RPE ${set.rpe}` : ''}
        </Text>
      </View>
    );
  }

  function renderWorkout({ item }: { item: WorkoutResponse }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
          {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
        </View>

        <View style={styles.setsContainer}>
          {item.sets && item.sets.length > 0 ? (
            item.sets.map(renderSet)
          ) : (
            <Text style={styles.emptyText}>No sets recorded</Text>
          )}
        </View>

        <Text style={styles.setCount}>
          {item.sets?.length ?? 0} set{item.sets?.length !== 1 ? 's' : ''}
        </Text>
      </View>
    );
  }

  if (loading) {
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
              onRefresh={() => {
                setRefreshing(true);
                fetchWorkouts();
              }}
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
  listContent: { padding: 20, paddingBottom: 60 },
  card: {
    backgroundColor: '#14142A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  cardHeader: { marginBottom: 12 },
  cardDate: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardNotes: { fontSize: 13, color: '#888', marginTop: 4 },
  setsContainer: { borderTopWidth: 1, borderTopColor: '#2E2E4A', paddingTop: 10 },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  setNum: { fontSize: 13, color: '#6C63FF', fontWeight: '600' },
  setDetail: { fontSize: 13, color: '#ccc' },
  setCount: {
    marginTop: 10,
    fontSize: 12,
    color: '#555',
    textAlign: 'right',
  },
  emptyText: { color: '#555', fontSize: 13, paddingVertical: 8 },
  emptyTitle: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#555' },
});
