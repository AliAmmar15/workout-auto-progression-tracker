import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      '#0D0E12',
  surface: '#15171D',
  warm:    '#F5F0E8',
  muted:   '#52576B',
};

// ─── Muscle Group Data ────────────────────────────────────────────────────────

export const MUSCLE_GROUPS = [
  { label: 'Chest',     emoji: '🫁', color: '#e74c3c' },
  { label: 'Back',      emoji: '🔼', color: '#3498db' },
  { label: 'Legs',      emoji: '🦵', color: '#2ecc71' },
  { label: 'Shoulders', emoji: '🏔️', color: '#9b59b6' },
  { label: 'Arms',      emoji: '💪', color: '#e67e22' },
  { label: 'Core',      emoji: '🎯', color: '#1abc9c' },
  { label: 'Full Body', emoji: '🏋️', color: '#f39c12' },
  { label: 'Cardio',    emoji: '🏃', color: '#e91e63' },
];

/** Maps UI label → DB muscle_group values used in filtering. */
export const MUSCLE_GROUP_MAP: Record<string, string[]> = {
  Chest:       ['Chest'],
  Back:        ['Back'],
  Legs:        ['Legs'],
  Shoulders:   ['Shoulders'],
  Arms:        ['Biceps', 'Triceps', 'Arms'],
  Core:        ['Core'],
  'Full Body': ['Full Body'],
  Cardio:      ['Cardio'],
};

// ─── Component ────────────────────────────────────────────────────────────────

interface MuscleGridProps {
  onSelect: (muscle: string) => void;
}

export default function MuscleGrid({ onSelect }: MuscleGridProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>What are you{'\n'}training today?</Text>
      <Text style={styles.subtitle}>Pick a muscle group to get started</Text>

      <View style={styles.grid}>
        {MUSCLE_GROUPS.map((mg) => (
          <Pressable
            key={mg.label}
            style={({ pressed }) => [
              styles.card,
              { borderColor: mg.color },
              pressed && { transform: [{ scale: 0.95 }], backgroundColor: mg.color + '18' },
            ]}
            onPress={() => onSelect(mg.label)}
          >
            <Text style={styles.emoji}>{mg.emoji}</Text>
            <Text style={[styles.label, { color: mg.color }]}>{mg.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 22, paddingBottom: 48 },

  title: {
    fontSize: 30,
    fontWeight: '900',
    color: C.warm,
    lineHeight: 36,
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 20,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    width: '46.5%',
    backgroundColor: C.surface,
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  emoji: { fontSize: 28, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '700' },
});
