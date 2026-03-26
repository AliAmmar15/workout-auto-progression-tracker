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
import { getWorkouts, WorkoutResponse } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanDay {
  id: string;
  title: string;
  schedule: string;
  exercises: string[]; // exercise names
  extraCount?: number; // "+N" overflow
}

interface PlanGroup {
  id: string;
  name: string;
  badge: string;
  planCount: number;
  expanded: boolean;
  days: PlanDay[];
}

// ─── Sample plan data ─────────────────────────────────────────────────────────

const DEFAULT_PLANS: PlanDay[] = [
  {
    id: 'mon',
    title: 'Monday – Chest & Triceps – Block A',
    schedule: 'Week 1-4 · Monday',
    exercises: ['Bench Press', 'Incline Dumbbell', 'Cable Crossover', 'Tricep Pushdown', 'Overhead Extension'],
    extraCount: 1,
  },
  {
    id: 'tue',
    title: 'Tuesday – Legs & Abs – Block A',
    schedule: 'Week 1-4 · Tuesday',
    exercises: ['Squat', 'Leg Press', 'Leg Curl', 'Calf Raise', 'Plank'],
    extraCount: 3,
  },
  {
    id: 'wed',
    title: 'Wednesday – Back & Biceps – Block A',
    schedule: 'Week 1-4 · Wednesday',
    exercises: ['Deadlift', 'Pull-Up', 'Seated Row', 'Lat Pulldown', 'Barbell Curl'],
    extraCount: 1,
  },
  {
    id: 'thu',
    title: 'Thursday – Legs & Abs – Block A',
    schedule: 'Week 1-4 · Thursday',
    exercises: ['Leg Extension', 'Romanian Deadlift', 'Hip Thrust', 'Leg Curl', 'Crunches'],
    extraCount: 3,
  },
  {
    id: 'fri',
    title: 'Friday – Shoulders & Arms – Block A',
    schedule: 'Week 1-4 · Friday',
    exercises: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Hammer Curl', 'Tricep Dip'],
    extraCount: 1,
  },
];

// ─── Exercise Pill (replaces image thumbnails) ────────────────────────────────

function ExercisePill({ name }: { name: string }) {
  const initials = name
    .split(/[\s–]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View style={styles.exercisePill}>
      <Text style={styles.exercisePillText}>{initials}</Text>
    </View>
  );
}

// ─── Plan Day Card ────────────────────────────────────────────────────────────

function PlanCard({ day }: { day: PlanDay }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? day.exercises : day.exercises.slice(0, 4);
  return (
    <View style={styles.planCard}>
      {/* Dumbbell icon top-right */}
      <View style={styles.planCardTopRight}>
        <Text style={styles.dumbbellIcon}>🏋️</Text>
      </View>

      <Text style={styles.planCardTitle}>{day.title}</Text>
      <Text style={styles.planCardSchedule}>{day.schedule}</Text>

      {/* Exercise pills row */}
      <View style={styles.pillsRow}>
        {shown.map((ex) => (
          <ExercisePill key={ex} name={ex} />
        ))}
        {!expanded && day.extraCount ? (
          <View style={[styles.exercisePill, { backgroundColor: '#2a3044' }]}>
            <Text style={[styles.exercisePillText, { color: '#8892a4' }]}>+{day.extraCount}</Text>
          </View>
        ) : null}
      </View>

      {/* Show more / show less */}
      <TouchableOpacity onPress={() => setExpanded((e) => !e)}>
        <Text style={styles.showMoreText}>{expanded ? '▲ Show less' : '▾ Show more'}</Text>
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={styles.planCardActions}>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>▶</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>⊞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Plans Screen ─────────────────────────────────────────────────────────────

export default function PlansScreen() {
  const token = useAuthStore((s) => s.token);
  const navigation = useNavigation<BottomTabNavigationProp<any>>();
  const [search, setSearch] = useState('');
  const [defaultExpanded, setDefaultExpanded] = useState(true);

  const filtered = DEFAULT_PLANS.filter(
    (d) => !search || d.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅  Workout Plans</Text>
        <Text style={styles.headerSubtitle}>Create and manage your training routines</Text>
      </View>

      {/* ── Toolbar ── */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('Log')}>
            <Text style={styles.outlineBtnText}>+ Create Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>Options ▾</Text>
          </TouchableOpacity>
        </View>
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
      </View>

      {/* ── Default Plans group ── */}
      <View style={styles.groupCard}>
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => setDefaultExpanded((e) => !e)}
        >
          <View style={styles.groupHeaderLeft}>
            <Text style={styles.groupStarIcon}>☆</Text>
            <View>
              <View style={styles.groupTitleRow}>
                <Text style={styles.groupName}>Default Plans</Text>
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              </View>
              <Text style={styles.groupSubtitle}>10 professional plans</Text>
            </View>
          </View>
          <Text style={styles.chevron}>{defaultExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Week 1-4 label ── */}
      {defaultExpanded && (
        <>
          <View style={styles.weekLabelRow}>
            <Text style={styles.weekLabelIcon}>📅</Text>
            <Text style={styles.weekLabel}>Week 1-4</Text>
            <Text style={styles.weekLabelCount}>(5 plans)</Text>
          </View>

          {/* Plan cards grid */}
          <View style={styles.planGrid}>
            {filtered.map((day) => (
              <View key={day.id}>
                <PlanCard day={day} />
                <TouchableOpacity 
                   style={[styles.outlineBtn, { marginTop: 8, alignSelf: 'flex-start', borderColor: '#00d4aa' }]}
                   onPress={() => navigation.navigate('Log')}
                >
                  <Text style={{ color: '#00d4aa', fontSize: 13, fontWeight: '600' }}>▶ Start this Plan</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
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
  toolbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  toolbarLeft: { flexDirection: 'row', gap: 8 },
  outlineBtn: {
    borderWidth: 1, borderColor: ACCENT, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  outlineBtnText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 10, height: 38,
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 13 },

  // Group card
  groupCard: {
    backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1,
    borderColor: ACCENT, marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupStarIcon: { fontSize: 20, color: ACCENT },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  groupName: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  adminBadge: {
    backgroundColor: '#252a3a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  adminBadgeText: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: '600' },
  groupSubtitle: { fontSize: 12, color: TEXT_SECONDARY },
  chevron: { color: TEXT_SECONDARY, fontSize: 16 },

  // Week label
  weekLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  weekLabelIcon: { fontSize: 14, color: ACCENT },
  weekLabel: { fontSize: 13, fontWeight: '700', color: ACCENT },
  weekLabelCount: { fontSize: 12, color: TEXT_SECONDARY },

  // Plan grid — single column for mobile; 2 per row could work too
  planGrid: { gap: 12 },

  // Plan card
  planCard: {
    backgroundColor: CARD_BG, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, position: 'relative',
  },
  planCardTopRight: {
    position: 'absolute', top: 12, right: 12,
  },
  dumbbellIcon: { fontSize: 18 },
  planCardTitle: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 4, paddingRight: 28 },
  planCardSchedule: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 12 },

  // Exercise pills
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  exercisePill: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: '#252a3a', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  exercisePillText: { color: ACCENT, fontSize: 11, fontWeight: '700' },

  showMoreText: { color: ACCENT, fontSize: 12, fontWeight: '600', marginBottom: 10 },

  // Plan card action row
  planCardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1, borderColor: ACCENT,
    justifyContent: 'center', alignItems: 'center',
  },
  actionBtnText: { color: ACCENT, fontSize: 16 },
});
