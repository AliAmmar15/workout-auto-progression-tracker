import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import useAuthStore from '../store/useAuthStore';
import { getExercises, ExerciseResponse } from '../services/api';

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise }: { exercise: ExerciseResponse }) {
  const initials = (exercise.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={styles.exerciseCard}>
      {/* Image placeholder with initials */}
      <View style={styles.exerciseImageBox}>
        <View style={styles.exerciseImageOverlay}>
          <Text style={styles.exerciseInitials}>{initials}</Text>
        </View>
        {/* Dumbbell badge */}
        <View style={styles.dumbbellBadge}>
          <Text style={{ fontSize: 12 }}>🏋️</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.exerciseDetails}>
        <Text style={styles.exerciseName} numberOfLines={2}>{exercise.name}</Text>

        {(exercise as any).description ? (
          <Text style={styles.exerciseDesc} numberOfLines={2}>• {(exercise as any).description}</Text>
        ) : null}

        {exercise.muscle_group ? (
          <Text style={styles.exercisePrimary}>
            <Text style={styles.primaryLabel}>Primary: </Text>
            {exercise.muscle_group}
          </Text>
        ) : null}

        <View style={styles.exerciseMetaRow}>
          <Text style={styles.exerciseMeta}>0.0kg</Text>
          <Text style={styles.exerciseMetaDot}>•</Text>
          <Text style={styles.exerciseMeta}>{(exercise as any).default_reps ?? 8} reps</Text>
          <Text style={styles.exerciseMetaDot}>•</Text>
          <Text style={styles.exerciseMeta}>{(exercise as any).default_sets ?? 3} sets</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Muscle Group Filters ─────────────────────────────────────────────────────

const MUSCLE_FILTERS = [
  'All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio',
];

// ─── Exercise Library Screen ──────────────────────────────────────────────────

export default function ExerciseLibraryScreen() {
  const token = useAuthStore((s) => s.token);
  const navigation = useNavigation<BottomTabNavigationProp<any>>();
  const [exercises, setExercises] = useState<ExerciseResponse[]>([]);
  const [filtered, setFiltered] = useState<ExerciseResponse[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getExercises(token)
      .then((data) => {
        setExercises(data);
        setFiltered(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Apply search + filter
  useEffect(() => {
    let result = exercises;
    if (activeFilter !== 'All') {
      result = result.filter((e) =>
        (e.muscle_group ?? '').toLowerCase().includes(activeFilter.toLowerCase())
      );
    }
    if (search.trim()) {
      result = result.filter((e) =>
        (e.name ?? '').toLowerCase().includes(search.toLowerCase())
      );
    }
    setFiltered(result);
  }, [search, activeFilter, exercises]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📚  Exercise Library</Text>
          <Text style={styles.headerSubtitle}>Browse and manage your exercise collection</Text>
        </View>

        {/* ── Toolbar ── */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('Log')}>
              <Text style={styles.outlineBtnText}>+ Add Exercise</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => setFiltersOpen((f) => !f)}
            >
              <Text style={styles.outlineBtnText}>Filters ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('Log')}>
              <Text style={styles.outlineBtnText}>Quick Log</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#555"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Muscle group filter chips */}
        {filtersOpen && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {MUSCLE_FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  activeFilter === f && styles.filterChipActive,
                ]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[
                  styles.filterChipText,
                  activeFilter === f && styles.filterChipTextActive,
                ]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Exercise grid ── */}
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyText}>Loading exercises…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>
              {search || activeFilter !== 'All'
                ? 'No exercises match your search.'
                : 'No exercises yet. Add one to get started!'}
            </Text>
            <TouchableOpacity style={styles.addFirstBtn} onPress={() => navigation.navigate('Log')}>
              <Text style={styles.addFirstBtnText}>+ Add Your First Exercise</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardGrid}>
            {filtered.map((ex) => (
              <ExerciseCard key={ex.id} exercise={ex} />
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ACCENT = '#00d4aa';
const BG = '#12151e';
const CARD_BG = '#1a1f2e';
const BORDER = '#252a3a';
const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#8892a4';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16 },

  // Header
  header: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: TEXT_SECONDARY },

  // Toolbar
  toolbar: { marginBottom: 10 },
  toolbarLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outlineBtn: {
    borderWidth: 1, borderColor: ACCENT, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  outlineBtnText: { color: ACCENT, fontSize: 13, fontWeight: '600' },

  // Search
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, height: 40, marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 13 },

  // Filter chips
  filterRow: { marginBottom: 14 },
  filterChip: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, backgroundColor: CARD_BG,
  },
  filterChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterChipText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#000' },

  // Card grid — 2 columns
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  // Exercise card
  exerciseCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    width: '47.5%',
  },

  // Image area
  exerciseImageBox: {
    height: 130,
    backgroundColor: '#252a3a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  exerciseImageOverlay: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1a2535',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ACCENT,
  },
  exerciseInitials: { color: ACCENT, fontSize: 22, fontWeight: '800' },
  dumbbellBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1f2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },

  // Details
  exerciseDetails: { padding: 12 },
  exerciseName: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 4 },
  exerciseDesc: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 6, lineHeight: 16 },
  exercisePrimary: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 6 },
  primaryLabel: { fontWeight: '700', color: TEXT_PRIMARY },
  exerciseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exerciseMeta: { fontSize: 11, color: TEXT_SECONDARY },
  exerciseMetaDot: { fontSize: 11, color: BORDER },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center' },
  addFirstBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addFirstBtnText: { color: ACCENT, fontSize: 14, fontWeight: '600' },
});
