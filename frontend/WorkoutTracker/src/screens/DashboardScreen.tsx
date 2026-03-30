import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import useAuthStore from '../store/useAuthStore';
import { getWorkouts, getExercises, WorkoutResponse, ExerciseResponse } from '../services/api';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:       '#0D0E12',
  surface:  '#15171D',
  accent:   '#E8522A',
  warm:     '#F5F0E8',
  muted:    '#52576B',
  divider:  '#1E2028',
  positive: '#3DBE7A',
  negative: '#E84A4A',
};

export default function DashboardScreen() {
  const token = useAuthStore((s) => s.token);
  const user  = useAuthStore((s) => s.user);
  const navigation = useNavigation<BottomTabNavigationProp<any>>();

  const [workouts,     setWorkouts]     = useState<WorkoutResponse[]>([]);
  const [exerciseMap,  setExerciseMap]  = useState<Record<number, string>>({});
  const [goalPerMonth, setGoalPerMonth] = useState(20);

  const now          = new Date();
  const [monthOffset, setMonthOffset] = useState(0);

  const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthLabel  = targetMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const todayLabel  = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getWorkouts(token).then(setWorkouts).catch(() => {});
      getExercises(token)
        .then((exs: ExerciseResponse[]) => {
          const m: Record<number, string> = {};
          exs.forEach((e) => { m[e.id] = e.name; });
          setExerciseMap(m);
        })
        .catch(() => {});
    }, [token])
  );

  // ── Derived stats ──
  const thisMonthWorkouts = workouts.filter((w) => {
    const d = new Date(w.date);
    return d.getFullYear() === targetMonth.getFullYear() && d.getMonth() === targetMonth.getMonth();
  });
  const progressPct   = Math.min(100, Math.round((thisMonthWorkouts.length / goalPerMonth) * 100));
  const totalWorkouts = workouts.length;
  const activeDays    = thisMonthWorkouts.length;

  const workoutsPerWeek = (() => {
    if (totalWorkouts === 0) return '0';
    if (totalWorkouts === 1) return '1.0';
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    const oldest = new Date(sorted[0].date).getTime();
    const newest = new Date(sorted[sorted.length - 1].date).getTime();
    const weeks  = Math.max(1, (newest - oldest) / (7 * 24 * 60 * 60 * 1000));
    return (totalWorkouts / weeks).toFixed(1);
  })();

  // ── Top lift (editorial spotlight — #1 by sessions) ──
  const topLift = (() => {
    const hist: Record<number, { first: number; latest: number; sessions: number }> = {};
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    for (const w of sorted) {
      for (const s of (w.sets ?? [])) {
        if (!hist[s.exercise_id]) {
          hist[s.exercise_id] = { first: s.weight, latest: s.weight, sessions: 0 };
        } else {
          hist[s.exercise_id].latest = s.weight;
        }
        hist[s.exercise_id].sessions += 1;
      }
    }
    const top = Object.entries(hist).sort((a, b) => b[1].sessions - a[1].sessions)[0];
    if (!top) return null;
    const [id, h] = top;
    return {
      name:   exerciseMap[Number(id)] ?? `Exercise #${id}`,
      latest: h.latest,
      pct:    h.first > 0 ? Math.round(((h.latest - h.first) / h.first) * 100) : 0,
    };
  })();

  // ── Volume bars (last 8 workouts) ──
  const volumeBars = (() => {
    const recent = [...workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).reverse();
    return recent.map((w) => ({
      label: new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      vol:   (w.sets ?? []).reduce((acc, s) => acc + s.weight * s.reps, 0),
    }));
  })();
  const maxVol = Math.max(...volumeBars.map((v) => v.vol), 1);

  // ── 7-day pill strip ──
  const weekPills = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      label:   d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
      active:  workouts.some((w) => w.date === dateStr),
      isToday: i === 6,
    };
  });

  function promptGoal() {
    if (Platform.OS === 'web') {
      const val = window.prompt('Set monthly workout goal (1–100):', String(goalPerMonth));
      const n   = parseInt(val ?? '', 10);
      if (!isNaN(n) && n >= 1 && n <= 100) setGoalPerMonth(n);
    } else {
      Alert.prompt(
        'Monthly Goal',
        'Target workouts per month (1–100):',
        (val) => {
          const n = parseInt(val ?? '', 10);
          if (!isNaN(n) && n >= 1 && n <= 100) setGoalPerMonth(n);
        },
        'plain-text',
        String(goalPerMonth),
        'number-pad',
      );
    }
  }

  const firstName = (user?.username ?? 'Athlete').split(' ')[0];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

      {/* ── HEADER ── */}
      <View style={s.header}>
        <Text style={s.dateLine}>{todayLabel}</Text>
        <Text style={s.heroName}>{firstName}.</Text>
      </View>

      {/* ── LOG CTA ── */}
      <TouchableOpacity style={s.ctaStrip} onPress={() => navigation.navigate('Log')} activeOpacity={0.85}>
        <View style={s.ctaBar} />
        <View style={s.ctaBody}>
          <Text style={s.ctaTitle}>Start a workout</Text>
          <Text style={s.ctaSub}>Tap to log a session</Text>
        </View>
        <Text style={s.ctaArrow}>→</Text>
      </TouchableOpacity>

      {/* ── MONTHLY PROGRESS ── */}
      <View style={s.section}>
        <View style={s.monthRow}>
          <TouchableOpacity onPress={() => setMonthOffset((o) => o - 1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.monthNav}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => setMonthOffset((o) => o + 1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.monthNav}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.fillBarWrapper}>
          <Text style={s.progressHero}>{activeDays}</Text>
          <View style={s.fillBarCol}>
            <View style={s.fillBarTrack}>
              <View style={[s.fillBarFill, { width: `${progressPct}%` as any }]} />
            </View>
            <TouchableOpacity onPress={promptGoal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.goalLine}>of {goalPerMonth} workouts  ✏️</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.progressPct}>{progressPct}%</Text>
        </View>
      </View>

      {/* ── STAT STRIP ── */}
      <View style={s.statStrip}>
        <View style={[s.statZone, { flex: 2 }]}>
          <Text style={s.statHero}>{totalWorkouts}</Text>
          <Text style={s.statHeroLabel}>Total Workouts</Text>
        </View>
        <View style={s.vertDivider} />
        <View style={[s.statZone, { flex: 1.5 }]}>
          <View style={s.statRow}>
            <Text style={s.statVal}>{workoutsPerWeek}</Text>
            <Text style={s.statUnit}> / week</Text>
          </View>
          <View style={s.statRow}>
            <Text style={s.statVal}>N/A</Text>
            <Text style={s.statUnit}> avg mins</Text>
          </View>
        </View>
      </View>

      {/* ── WEEK PILLS ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>THIS WEEK</Text>
        <View style={s.pillRow}>
          {weekPills.map((p, i) => (
            <View key={i} style={s.pillCol}>
              <View style={[s.pill, p.active && s.pillActive, p.isToday && s.pillToday]}>
                <Text style={[s.pillLetter, p.active && s.pillLetterActive]}>{p.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── TOP LIFT SPOTLIGHT ── */}
      {topLift && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>TOP LIFT</Text>
          <View style={s.spotlightRow}>
            <View style={s.spotlightBar} />
            <View style={s.spotlightBody}>
              <Text style={s.spotlightName} numberOfLines={1}>{topLift.name}</Text>
              <Text style={s.spotlightWeight}>
                {topLift.latest} <Text style={s.spotlightUnit}>lbs</Text>
              </Text>
            </View>
            {topLift.pct !== 0 && (
              <View style={[s.pctBadge, topLift.pct > 0 ? s.pctPos : s.pctNeg]}>
                <Text style={[s.pctText, topLift.pct > 0 ? s.pctPosText : s.pctNegText]}>
                  {topLift.pct > 0 ? '+' : ''}{topLift.pct}%
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── VOLUME BARS ── */}
      {volumeBars.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>VOLUME — LAST {volumeBars.length} SESSIONS</Text>
          <View style={s.volChart}>
            {volumeBars.map((v, i) => {
              const isLast = i === volumeBars.length - 1;
              const pct    = Math.max(4, Math.round((v.vol / maxVol) * 100));
              return (
                <View key={i} style={s.volCol}>
                  <View style={s.volBarTrack}>
                    <View style={[s.volBarFill, { height: `${pct}%` as any }, isLast && s.volBarAccent]} />
                  </View>
                  <Text style={[s.volLabel, isLast && s.volLabelAccent]}>{v.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── HEALTH METRICS ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>HEALTH METRICS</Text>
        <View style={s.metricsRow}>
          <Text style={s.metricsSub}>BMI Calculator</Text>
          <TouchableOpacity style={s.metricsBtn} onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Text style={s.metricsBtnText}>Calculate →</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 22, paddingTop: 56, paddingBottom: 24 },

  // Header
  header:   { marginBottom: 40 },
  dateLine: { color: C.muted, fontSize: 12, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'right', marginBottom: 6 },
  heroName: { color: C.warm, fontSize: 52, fontWeight: '800', letterSpacing: -1.5, lineHeight: 56 },

  // CTA strip
  ctaStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 4, marginBottom: 28, overflow: 'hidden' },
  ctaBar:   { width: 4, alignSelf: 'stretch', backgroundColor: C.accent },
  ctaBody:  { flex: 1, paddingVertical: 16, paddingHorizontal: 14 },
  ctaTitle: { color: C.warm, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  ctaSub:   { color: C.muted, fontSize: 12 },
  ctaArrow: { color: C.accent, fontSize: 20, fontWeight: '300', paddingRight: 16 },

  // Section wrapper
  section:      { marginBottom: 28 },
  sectionLabel: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },

  // Monthly progress
  monthRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  monthNav:       { color: C.accent, fontSize: 24, fontWeight: '300', paddingHorizontal: 4 },
  monthLabel:     { flex: 1, textAlign: 'center', color: C.warm, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  fillBarWrapper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressHero:   { color: C.warm, fontSize: 72, fontWeight: '900', lineHeight: 72, width: 94, textAlign: 'right' },
  fillBarCol:     { flex: 1 },
  fillBarTrack:   { height: 6, backgroundColor: C.divider, borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  fillBarFill:    { height: 6, backgroundColor: C.accent, borderRadius: 3 },
  goalLine:       { color: C.muted, fontSize: 12 },
  progressPct:    { color: C.muted, fontSize: 13, fontWeight: '600', width: 40, textAlign: 'right' },

  // Stat strip
  statStrip:     { flexDirection: 'row', marginBottom: 32, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.divider },
  statZone:      { paddingHorizontal: 4, justifyContent: 'center' },
  statHero:      { color: C.warm, fontSize: 56, fontWeight: '900', lineHeight: 58, letterSpacing: -1 },
  statHeroLabel: { color: C.muted, fontSize: 12, fontWeight: '500', letterSpacing: 0.5, marginTop: 2 },
  vertDivider:   { width: 1, backgroundColor: C.divider, marginHorizontal: 12 },
  statRow:       { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  statVal:       { color: C.warm, fontSize: 28, fontWeight: '700', lineHeight: 30 },
  statUnit:      { color: C.muted, fontSize: 11 },

  // Week pills
  pillRow:          { flexDirection: 'row', gap: 6 },
  pillCol:          { flex: 1, alignItems: 'center' },
  pill:             { width: 34, height: 34, borderRadius: 17, backgroundColor: C.divider, justifyContent: 'center', alignItems: 'center' },
  pillActive:       { backgroundColor: C.accent },
  pillToday:        { borderWidth: 2, borderColor: C.warm, backgroundColor: C.divider },
  pillLetter:       { color: C.muted, fontSize: 11, fontWeight: '600' },
  pillLetterActive: { color: C.warm, fontSize: 11, fontWeight: '700' },

  // Top lift spotlight
  spotlightRow:    { flexDirection: 'row', alignItems: 'center' },
  spotlightBar:    { width: 3, alignSelf: 'stretch', backgroundColor: C.accent, borderRadius: 2, marginRight: 14 },
  spotlightBody:   { flex: 1 },
  spotlightName:   { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 4 },
  spotlightWeight: { color: C.warm, fontSize: 40, fontWeight: '900', lineHeight: 42, letterSpacing: -1 },
  spotlightUnit:   { fontSize: 14, fontWeight: '400', color: C.muted },
  pctBadge:        { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  pctPos:          { backgroundColor: '#1C3B2C' },
  pctNeg:          { backgroundColor: '#3B1C1C' },
  pctText:         { fontSize: 13, fontWeight: '700' },
  pctPosText:      { color: C.positive },
  pctNegText:      { color: C.negative },

  // Volume bars
  volChart:      { flexDirection: 'row', alignItems: 'flex-end', height: 88, gap: 5 },
  volCol:        { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  volBarTrack:   { width: '100%', flex: 1, backgroundColor: C.divider, borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' },
  volBarFill:    { width: '100%', backgroundColor: C.surface, borderRadius: 3 },
  volBarAccent:  { backgroundColor: C.accent },
  volLabel:      { color: C.muted, fontSize: 8, marginTop: 5, textAlign: 'center' },
  volLabelAccent:{ color: C.accent },

  // Health metrics
  metricsRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricsSub:     { color: C.muted, fontSize: 13 },
  metricsBtn:     { borderWidth: 1, borderColor: C.accent, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 14 },
  metricsBtnText: { color: C.accent, fontSize: 13, fontWeight: '600' },
});
