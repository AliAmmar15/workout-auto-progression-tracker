import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ExerciseResponse } from '../../services/api';
import useWorkoutSessionStore from '../../store/useWorkoutSessionStore';
import { MUSCLE_GROUP_MAP } from './MuscleGrid';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      '#0D0E12',
  surface: '#15171D',
  accent:  '#E8522A',
  warm:    '#F5F0E8',
  muted:   '#52576B',
  divider: '#1E2028',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ExercisePickerProps {
  muscleName: string;
  allExercises: ExerciseResponse[];
  onBack: () => void;
  onContinue: () => void;
  onCreateExercise: (name: string, equipment: string) => Promise<void>;
}

const EQUIPMENT_OPTIONS = ['bodyweight', 'barbell', 'dumbbell', 'machine', 'cable'] as const;
type Equipment = typeof EQUIPMENT_OPTIONS[number];

export default function ExercisePicker({
  muscleName,
  allExercises,
  onBack,
  onContinue,
  onCreateExercise,
}: ExercisePickerProps) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>('bodyweight');

  const { selectedExercises, recentlyUsedExerciseIds, toggleExercise } =
    useWorkoutSessionStore();

  // All exercises for this muscle group
  const muscleExercises = useMemo(() => {
    const groups = MUSCLE_GROUP_MAP[muscleName] ?? [muscleName];
    return allExercises.filter((e) =>
      groups.some((g) => e.muscle_group.toLowerCase() === g.toLowerCase()),
    );
  }, [allExercises, muscleName]);

  // Recently used exercises that belong to this muscle group
  const recentExercises = useMemo(() => {
    const muscleIds = new Set<string | number>(muscleExercises.map((e) => e.id));
    return recentlyUsedExerciseIds
      .filter((id) => muscleIds.has(id))
      .map((id) => muscleExercises.find((e) => e.id === id))
      .filter((e): e is ExerciseResponse => e !== undefined);
  }, [muscleExercises, recentlyUsedExerciseIds]);

  // Search-filtered list
  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return muscleExercises;
    return muscleExercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [muscleExercises, search]);

  const isSelected = (id: string | number) => selectedExercises.some((se) => se.exercise.id === id);

  const searchActive = search.trim().length > 0;
  const noResults = searchActive && filteredExercises.length === 0;
  const showCreate = search.trim().length > 1 && filteredExercises.length === 0;
  const selectedCount = selectedExercises.length;

  async function handleCreate() {
    const name = search.trim().replace(/\s+/g, ' ');
    if (!name) return;

    // Client-side duplicate check
    const duplicate = allExercises.some(
      (e) => (e.name ?? '').toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      // Exercise already exists — just select it
      const existing = allExercises.find(
        (e) => (e.name ?? '').toLowerCase() === name.toLowerCase(),
      );
      if (existing) toggleExercise(existing);
      setSearch('');
      return;
    }

    setCreating(true);
    try {
      await onCreateExercise(name, selectedEquipment);
      setSearch('');
    } finally {
      setCreating(false);
    }
  }

  function renderExerciseRow(ex: ExerciseResponse, showRecentBadge = false) {
    const sel = isSelected(ex.id);
    return (
      <TouchableOpacity
        key={ex.id}
        style={[styles.exRow, sel && styles.exRowSelected]}
        onPress={() => toggleExercise(ex)}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.exNameRow}>
            <Text style={[styles.exName, sel && { color: '#fff' }]}>{ex.name}</Text>
            {showRecentBadge && !sel && (
              <View style={styles.recentBadge}>
                <Text style={styles.recentBadgeText}>RECENT</Text>
              </View>
            )}
          </View>
          <Text style={styles.exMeta}>{ex.muscle_group} · {ex.equipment}</Text>
        </View>
        <View style={[styles.checkCircle, sel && styles.checkCircleFilled]}>
          <Text style={{ color: sel ? '#fff' : '#555', fontSize: 14, fontWeight: '700' }}>
            {sel ? '✓' : '+'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{muscleName}</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises…"
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>

        {/* Create custom exercise row */}
        {showCreate && (
          <View>
            {/* Equipment picker chips */}
            <View style={styles.equipmentRow}>
              {EQUIPMENT_OPTIONS.map((eq) => (
                <TouchableOpacity
                  key={eq}
                  style={[
                    styles.equipmentChip,
                    selectedEquipment === eq && styles.equipmentChipSelected,
                  ]}
                  onPress={() => setSelectedEquipment(eq)}
                >
                  <Text
                    style={[
                      styles.equipmentChipText,
                      selectedEquipment === eq && styles.equipmentChipTextSelected,
                    ]}
                  >
                    {eq.charAt(0).toUpperCase() + eq.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.createRow}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.8}
            >
              {creating ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <>
                  <Text style={styles.createIcon}>＋</Text>
                  <View>
                    <Text style={styles.createName}>Create "{search.trim()}"</Text>
                    <Text style={styles.createMeta}>{selectedEquipment} · {muscleName}</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Recently used section (only when not searching) */}
        {!searchActive && recentExercises.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>RECENTLY USED</Text>
            {recentExercises.map((ex) => renderExerciseRow(ex, true))}
            <Text style={styles.sectionHeader}>ALL EXERCISES</Text>
          </>
        )}

        {/* Exercise list */}
        {!searchActive
          ? muscleExercises.map((ex) => renderExerciseRow(ex))
          : filteredExercises.map((ex) => renderExerciseRow(ex))}

        {/* Empty states */}
        {!searchActive && muscleExercises.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptySubtitle}>
              Type a name above to create your first {muscleName} exercise
            </Text>
          </View>
        )}
        {noResults && !showCreate && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptySubtitle}>
              Type the full name to create a custom exercise
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating continue bar */}
      {selectedCount > 0 && (
        <View style={styles.floatingBar}>
          <TouchableOpacity style={styles.floatingBtn} onPress={onContinue} activeOpacity={0.9}>
            <Text style={styles.floatingBtnText}>
              Log {selectedCount} Exercise{selectedCount > 1 ? 's' : ''} →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.warm },
  backBtn:     { paddingVertical: 4 },
  backBtnText: { color: C.accent, fontSize: 14, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 6,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.divider,
  },
  searchIcon:  { paddingLeft: 12, fontSize: 16 },
  searchInput: { flex: 1, paddingHorizontal: 10, paddingVertical: 13, color: C.warm, fontSize: 15 },
  clearIcon:   { color: C.muted, fontSize: 18, paddingRight: 12 },

  listContent: { paddingHorizontal: 16, paddingBottom: 130 },

  sectionHeader: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },

  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.accent,
  },
  createIcon: { color: C.accent, fontSize: 22, fontWeight: '700' },
  createName: { color: C.accent, fontSize: 15, fontWeight: '700' },
  createMeta: { color: C.muted, fontSize: 12, marginTop: 2 },

  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.divider,
  },
  exRowSelected: { borderColor: C.accent, borderLeftWidth: 3 },
  exNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  exName:        { color: C.warm, fontSize: 15, fontWeight: '600' },
  exMeta:        { color: C.muted, fontSize: 12, marginTop: 3 },

  recentBadge: {
    backgroundColor: C.accent + '18',
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  recentBadgeText: { color: C.accent, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkCircleFilled: { backgroundColor: C.accent, borderColor: C.accent },

  equipmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    paddingTop: 4,
  },
  equipmentChip: {
    borderWidth: 1,
    borderColor: C.divider,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: C.surface,
  },
  equipmentChipSelected: { borderColor: C.accent, backgroundColor: C.accent + '22' },
  equipmentChipText:         { color: C.muted, fontSize: 12, fontWeight: '600' },
  equipmentChipTextSelected: { color: C.accent },

  emptyState:    { alignItems: 'center', marginTop: 60 },
  emptyIcon:     { fontSize: 40, marginBottom: 12 },
  emptyTitle:    { color: C.muted, fontSize: 16, fontWeight: '600' },
  emptySubtitle: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },

  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  floatingBtn:     { backgroundColor: C.accent, borderRadius: 6, padding: 16, alignItems: 'center' },
  floatingBtnText: { color: C.warm, fontSize: 16, fontWeight: '700' },
});
