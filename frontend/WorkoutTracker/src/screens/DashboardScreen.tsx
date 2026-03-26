import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import useAuthStore from '../store/useAuthStore';
import { getWorkouts, WorkoutResponse } from '../services/api';

// ─── Circular Progress Ring ───────────────────────────────────────────────────

interface CircularProgressProps {
  percentage: number; // 0–100
  radius?: number;
  strokeWidth?: number;
  color?: string;
}

function CircularProgress({
  percentage,
  radius = 80,
  strokeWidth = 10,
  color = '#00d4aa',
}: CircularProgressProps) {
  const size = radius * 2 + strokeWidth * 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (percentage / 100) * circumference;
  const gap = circumference - filled;

  // We replicate a ring using nested views + absolute positioned arcs via
  // border tricks (no SVG dependency required).
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Track ring */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: '#2a3044',
        }}
      />
      {/* Progress arc — approximation using a clipped coloured ring */}
      {percentage > 0 && (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: percentage >= 25 ? color : 'transparent',
            borderBottomColor: percentage >= 50 ? color : 'transparent',
            borderLeftColor: percentage >= 75 ? color : 'transparent',
            transform: [{ rotate: '-90deg' }],
          }}
        />
      )}
      {/* Inner content */}
      <Text style={{ color: color, fontSize: 26, fontWeight: '700' }}>{percentage}%</Text>
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

function QuickActionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.quickIconBox}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={{ marginLeft: 12 }}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Dashboard Screen ────────────────────────────────────────────────────

export default function DashboardScreen() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<BottomTabNavigationProp<any>>();

  const [workouts, setWorkouts] = useState<WorkoutResponse[]>([]);

  // Month navigation state
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [progressTrackerOpen, setProgressTrackerOpen] = useState(false);

  const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthLabel = targetMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Fetch workouts when screen focuses
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getWorkouts(token)
        .then(setWorkouts)
        .catch(() => {});
    }, [token])
  );

  // Compute stats
  const GOAL_PER_MONTH = 20;
  const thisMonthWorkouts = workouts.filter((w) => {
    const d = new Date(w.date);
    return d.getFullYear() === targetMonth.getFullYear() && d.getMonth() === targetMonth.getMonth();
  });
  const progressPct = Math.min(100, Math.round((thisMonthWorkouts.length / GOAL_PER_MONTH) * 100));
  const totalWorkouts = workouts.length;

  // Calculate avg duration (placeholder — no duration field yet)
  const avgDuration = totalWorkouts > 0 ? '1.0 minutes' : '0 minutes';
  const workoutsPerWeek = totalWorkouts > 0 ? (totalWorkouts / 4).toFixed(1) : '0';
  const activeDays = thisMonthWorkouts.length;

  const username = user?.username ?? 'Athlete';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏠  Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          Welcome <Text style={styles.accentText}>{username}</Text> – This is where your fitness journey begins!
        </Text>
      </View>

      {/* ── Quick Actions ── */}
      <View style={styles.quickRow}>
        <QuickActionCard icon="▶️" title="Start a New Workout" subtitle="Log Session" onPress={() => navigation.navigate('Log')} />
        <QuickActionCard icon="🔍" title="Explore Exercises" subtitle="Exercise Library" onPress={() => navigation.navigate('Library')} />
      </View>

      {/* ── Monthly Progress ── */}
      <View style={styles.card}>
        {/* Month navigation header */}
        <View style={styles.monthNavRow}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setMonthOffset((o) => o - 1)}
          >
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthLabel} Progress</Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setMonthOffset((o) => o + 1)}
          >
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Circular progress */}
        <View style={styles.circleWrapper}>
          <CircularProgress percentage={progressPct} />
        </View>

        {/* Goal badge */}
        <View style={styles.goalBadge}>
          <Text style={styles.goalText}>🎯 Goal: {GOAL_PER_MONTH} workouts/month</Text>
          <Text style={styles.goalEdit}>✏️</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.inlineStatCard}>
            <Text style={styles.inlineStatValue}>{activeDays}/{GOAL_PER_MONTH}</Text>
            <Text style={styles.inlineStatLabel}>Active Days</Text>
          </View>
          <View style={styles.inlineStatCard}>
            <Text style={styles.inlineStatValue}>{totalWorkouts > 0 ? '1' : '0'}</Text>
            <Text style={styles.inlineStatLabel}>Avg Min/Day</Text>
          </View>
          <View style={styles.inlineStatCard}>
            <Text style={styles.inlineStatValue}>{workoutsPerWeek}</Text>
            <Text style={styles.inlineStatLabel}>Workouts/Week</Text>
          </View>
        </View>
      </View>

      {/* ── Bottom Stat Cards ── */}
      <View style={styles.bottomStatsRow}>
        <View style={[styles.bottomStatCard, { flex: 1, marginRight: 8 }]}>
          <View style={styles.bottomStatHeader}>
            <Text style={styles.bottomStatIcon}>📈</Text>
            <Text style={styles.bottomStatTitle}>Total Workouts</Text>
          </View>
          <Text style={styles.bottomStatValue}>{totalWorkouts}</Text>
        </View>

        <View style={[styles.bottomStatCard, { flex: 1, marginHorizontal: 4 }]}>
          <View style={styles.bottomStatHeader}>
            <Text style={styles.bottomStatIcon}>⏱</Text>
            <Text style={styles.bottomStatTitle}>Avg Duration</Text>
          </View>
          <Text style={styles.bottomStatValue}>{avgDuration}</Text>
        </View>

        <View style={[styles.bottomStatCard, { flex: 1, marginLeft: 8 }]}>
          <View style={styles.bottomStatHeader}>
            <Text style={styles.bottomStatIcon}>⚡</Text>
            <Text style={styles.bottomStatTitle}>Health Metrics</Text>
          </View>
          <Text style={styles.bottomStatSub}>BMI Calculator</Text>
          <TouchableOpacity style={styles.calcBtn}>
            <Text style={styles.calcBtnText}>Calculate</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Progress Tracker ── */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📊  Progress Tracker</Text>
          <TouchableOpacity onPress={() => setProgressTrackerOpen((o) => !o)}>
            <Text style={styles.viewAllText}>{progressTrackerOpen ? 'Hide ▲' : 'Show ▼'}</Text>
          </TouchableOpacity>
        </View>
        {progressTrackerOpen ? (
          <Text style={styles.emptyText}>Progress chart coming soon…</Text>
        ) : (
          <View style={styles.trackerCollapsed}>
            <Text style={styles.trackerHint}>Track your exercise and weight progress</Text>
            <Text style={[styles.trackerHint, { fontSize: 11 }]}>Click 'Show' to expand</Text>
          </View>
        )}
      </View>

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
  header: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 6 },
  headerSubtitle: { fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center' },
  accentText: { color: ACCENT, fontWeight: '700' },

  // Quick actions
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  quickCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  quickIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#252a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickTitle: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 2 },
  quickSubtitle: { fontSize: 11, color: TEXT_SECONDARY },

  // Generic card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },

  // Month nav
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  navBtn: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1, borderColor: BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  navBtnText: { color: ACCENT, fontSize: 22, lineHeight: 26 },
  monthTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },

  // Circle
  circleWrapper: { alignItems: 'center', marginBottom: 16 },

  // Goal badge
  goalBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#252a3a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'center', marginBottom: 16, gap: 8,
  },
  goalText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  goalEdit: { color: TEXT_SECONDARY, fontSize: 13 },

  // Inline stats inside progress card
  statsRow: { flexDirection: 'row', gap: 8 },
  inlineStatCard: {
    flex: 1, backgroundColor: '#252a3a', borderRadius: 10, padding: 12, alignItems: 'center',
  },
  inlineStatValue: { color: ACCENT, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  inlineStatLabel: { color: TEXT_SECONDARY, fontSize: 11 },

  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  viewAllText: { fontSize: 13, color: ACCENT, fontWeight: '600' },

  // XP bar
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpText: { fontSize: 12, color: TEXT_SECONDARY },
  levelText: { fontSize: 12, color: ACCENT, fontWeight: '700' },
  xpBarTrack: { height: 6, backgroundColor: '#252a3a', borderRadius: 3, marginBottom: 14 },
  xpBarFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  recentLabel: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 10 },

  // Achievement card
  achievementCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#252a3a', borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  achievementLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  achievementIconBox: {
    width: 42, height: 42, borderRadius: 10, backgroundColor: '#1a1f2e',
    justifyContent: 'center', alignItems: 'center',
  },
  achievementName: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },
  achievementDesc: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },
  achievementXP: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 },
  achievementRight: { alignItems: 'flex-end', gap: 4 },
  tierBadge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  unlockedText: { fontSize: 11, color: ACCENT, fontWeight: '600' },

  // Empty achievement
  emptyAchievement: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center' },

  // Bottom stats
  bottomStatsRow: { flexDirection: 'row', marginBottom: 16 },
  bottomStatCard: {
    backgroundColor: CARD_BG, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  bottomStatHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  bottomStatIcon: { fontSize: 16 },
  bottomStatTitle: { fontSize: 12, color: TEXT_PRIMARY, fontWeight: '700', flex: 1 },
  bottomStatValue: { fontSize: 14, color: ACCENT, fontWeight: '700' },
  bottomStatSub: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 8 },
  calcBtn: {
    borderWidth: 1, borderColor: ACCENT, borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 10, alignSelf: 'flex-start',
  },
  calcBtnText: { color: ACCENT, fontSize: 12, fontWeight: '600' },

  // Progress tracker
  trackerCollapsed: { paddingVertical: 20, alignItems: 'center', gap: 4 },
  trackerHint: { color: TEXT_SECONDARY, fontSize: 13 },

  // Generic stat card (unused but kept)
  statCard: { flex: 1, backgroundColor: '#252a3a', borderRadius: 10, padding: 12, alignItems: 'center' },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { color: ACCENT, fontSize: 18, fontWeight: '800' },
  statLabel: { color: TEXT_SECONDARY, fontSize: 11, textAlign: 'center' },
});
