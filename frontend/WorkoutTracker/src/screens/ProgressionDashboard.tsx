import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import useAuthStore from '../store/useAuthStore';
import {
  getExercises,
  getProgression,
  getRecommendation,
  ExerciseResponse,
  ProgressionResponse,
  RecommendationResponse,
} from '../services/api';

/**
 * ProgressionDashboard — shows the user's progression analysis and
 * next-session recommendation for a selected exercise.
 *
 * Uses the reps-based progression engine:
 *   trend = improving | stable | regressing
 *   plateau_detected → deload recommendation
 *   last_outcome = success | partial | failure
 */
export default function ProgressionDashboard() {
  const token = useAuthStore((s) => s.token);
  const [exercises, setExercises] = useState<ExerciseResponse[]>([]);
  const [selected, setSelected] = useState<ExerciseResponse | null>(null);
  const [progression, setProgression] = useState<ProgressionResponse | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getExercises(token)
      .then((data) => {
        setExercises(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch(() => setFetchError('Could not reach backend. Make sure the server is running on port 8000.'))
      .finally(() => setLoadingExercises(false));
  }, [token]);

  useEffect(() => {
    if (!token || !selected) return;
    setLoadingData(true);
    setProgression(null);
    setRecommendation(null);

    Promise.all([
      getProgression(token, selected.id),
      getRecommendation(token, selected.id),
    ])
      .then(([prog, rec]) => {
        setProgression(prog);
        setRecommendation(rec);
      })
      .catch(() => {
        if (Platform.OS === 'web') window.alert('Error\nCould not load progression data.');
        else Alert.alert('Error', 'Could not load progression data.');
      })
      .finally(() => setLoadingData(false));
  }, [token, selected]);

  function trendColor(trend: string) {
    if (trend === 'improving') return '#22c55e';
    if (trend === 'regressing') return '#ef4444';
    return '#f59e0b';
  }

  function outcomeIcon(outcome: string | null) {
    if (outcome === 'success') return '✅';
    if (outcome === 'partial') return '⚠️';
    if (outcome === 'failure') return '❌';
    return '—';
  }

  if (loadingExercises) {
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
      <Text style={styles.title}>Progression Dashboard</Text>

      {/* Exercise selector */}
      <Text style={styles.sectionLabel}>Select Exercise</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
        {exercises.map((ex) => (
          <TouchableOpacity
            key={ex.id}
            style={[styles.pill, selected?.id === ex.id && styles.pillActive]}
            onPress={() => setSelected(ex)}
          >
            <Text style={[styles.pillText, selected?.id === ex.id && styles.pillTextActive]}>
              {ex.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loadingData ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="small" color="#6C63FF" />
        </View>
      ) : progression && recommendation ? (
        <>
          {/* Trend card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Performance Trend</Text>
            <Text style={[styles.trendBadge, { color: trendColor(progression.trend) }]}>
              {progression.trend.toUpperCase()}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Last Outcome</Text>
                <Text style={styles.metaValue}>
                  {outcomeIcon(progression.last_outcome)}{' '}
                  {progression.last_outcome ?? 'No data'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Plateau</Text>
                <Text style={styles.metaValue}>
                  {progression.plateau_detected ? '⚠️ Detected' : '✅ None'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Personal Record</Text>
                <Text style={styles.metaValue}>{progression.is_pr ? '🏆 PR!' : 'Not yet'}</Text>
              </View>
            </View>
          </View>

          {/* Recent sets */}
          {progression.recent_sets.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Sets</Text>
              {progression.recent_sets.map((s, i) => (
                <View key={i} style={styles.setRow}>
                  <Text style={styles.setIdx}>#{i + 1}</Text>
                  <Text style={styles.setDetail}>
                    {s.weight} lbs × {s.reps} reps
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Recommendation */}
          <View style={[styles.card, recommendation.is_deload && styles.deloadCard]}>
            <Text style={styles.cardTitle}>
              {recommendation.is_deload ? '⚠️ Deload Recommended' : '🎯 Next Session Target'}
            </Text>
            <Text style={styles.recommendWeight}>{recommendation.recommended_weight} lbs</Text>
            <Text style={styles.recommendReps}>× {recommendation.recommended_reps} reps</Text>
            <Text style={styles.reasoning}>{recommendation.reasoning}</Text>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Data Yet</Text>
          <Text style={styles.emptyText}>Log a workout for this exercise to see your progression.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  content: { padding: 20, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F1A' },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 20 },
  sectionLabel: { fontSize: 13, color: '#aaa', marginBottom: 8 },
  pillRow: { flexDirection: 'row', marginBottom: 20 },
  pill: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  pillActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  pillText: { color: '#aaa', fontSize: 13 },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  loadingArea: { marginTop: 40, alignItems: 'center' },
  card: {
    backgroundColor: '#14142A',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  deloadCard: { borderColor: '#f59e0b', backgroundColor: '#1C1500' },
  cardTitle: { fontSize: 14, color: '#888', fontWeight: '600', marginBottom: 10 },
  trendBadge: { fontSize: 24, fontWeight: '800', marginBottom: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaItem: { flex: 1, alignItems: 'center' },
  metaLabel: { fontSize: 11, color: '#555', marginBottom: 4 },
  metaValue: { fontSize: 13, color: '#ddd', fontWeight: '600', textAlign: 'center' },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  setIdx: { color: '#6C63FF', fontWeight: '600', fontSize: 13 },
  setDetail: { color: '#ccc', fontSize: 13 },
  recommendWeight: { fontSize: 42, fontWeight: '800', color: '#6C63FF', marginTop: 6 },
  recommendReps: { fontSize: 18, color: '#aaa', marginBottom: 12 },
  reasoning: { fontSize: 13, color: '#777', lineHeight: 20 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22 },
});
