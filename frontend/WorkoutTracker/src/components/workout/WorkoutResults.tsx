import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { WorkoutProgressionItem } from '../../services/api';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      '#0D0E12',
  surface: '#15171D',
  accent:  '#E8522A',
  warm:    '#F5F0E8',
  muted:   '#52576B',
  divider: '#1E2028',
};

// ─── Action config ────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  increase: { color: '#2ecc71', icon: '📈', label: 'Increase Weight' },
  maintain: { color: '#f39c12', icon: '➡️', label: 'Maintain Weight' },
  decrease: { color: '#e74c3c', icon: '📉', label: 'Decrease Weight' },
  deload:   { color: '#9b59b6', icon: '🔄', label: 'Deload' },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface WorkoutResultsProps {
  progressions: WorkoutProgressionItem[];
  onDone: () => void;
}

export default function WorkoutResults({ progressions, onDone }: WorkoutResultsProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Saved.</Text>
        <Text style={styles.bannerSub}>Here's your progression for next session</Text>
      </View>

      {/* Progression cards */}
      {progressions.length === 0 ? (
        <View style={styles.noProgressionWrap}>
          <Text style={styles.noProgressionText}>
            No progression data yet — log more sessions to unlock recommendations.
          </Text>
        </View>
      ) : (
        progressions.map((p) => {
          const cfg = ACTION_CONFIG[p.action] ?? ACTION_CONFIG['maintain'];
          return (
            <View
              key={p.exercise_id}
              style={[styles.card, { borderColor: cfg.color }]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>{cfg.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{p.exercise_name}</Text>
                  <Text style={[styles.actionLabel, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                {p.next_weight > 0 && (
                  <View
                    style={[
                      styles.weightBadge,
                      { backgroundColor: cfg.color + '22', borderColor: cfg.color },
                    ]}
                  >
                    <Text style={[styles.weightBadgeText, { color: cfg.color }]}>
                      {p.next_weight} lbs
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.reasoning}>{p.reasoning}</Text>
            </View>
          );
        })
      )}

      {/* Done button */}
      <TouchableOpacity style={styles.doneButton} onPress={onDone} activeOpacity={0.85}>
        <Text style={styles.doneButtonText}>Log Another Workout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 22, paddingBottom: 60 },

  banner: { alignItems: 'flex-start', marginBottom: 28, marginTop: 8 },
  bannerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: C.warm,
    letterSpacing: -1,
  },
  bannerSub: { fontSize: 13, color: C.muted, marginTop: 6 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: C.divider,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  cardIcon:     { fontSize: 28 },
  exerciseName: { color: C.warm, fontSize: 15, fontWeight: '700' },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  weightBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 4,
  },
  weightBadgeText: { fontSize: 14, fontWeight: '700' },
  reasoning: { color: C.muted, fontSize: 13, lineHeight: 19 },

  noProgressionWrap: { alignItems: 'center', marginTop: 20, marginBottom: 28 },
  noProgressionText: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  doneButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.accent,
  },
  doneButtonText: { color: C.accent, fontSize: 15, fontWeight: '700' },
});
