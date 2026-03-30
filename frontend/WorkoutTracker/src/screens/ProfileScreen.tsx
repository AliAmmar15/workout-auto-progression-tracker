import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../store/useAuthStore';
import { getWorkouts, WorkoutResponse, WorkoutSetResponse } from '../services/api';

function calcBmi(weightKg: number, heightCm: number) {
  if (weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function bmiCategory(bmi: number) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [workouts, setWorkouts] = useState<WorkoutResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [heightCm, setHeightCm] = useState('175');
  const [weightKg, setWeightKg] = useState('75');

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      getWorkouts(token)
        .then(setWorkouts)
        .catch(() => setWorkouts([]))
        .finally(() => setLoading(false));
    }, [token])
  );

  const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : 'U';

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : 'N/A';

  const totalWorkouts = workouts.length;
  const totalSets = workouts.reduce((acc, w) => acc + (w.sets?.length ?? 0), 0);
  const avgSetsPerWorkout = totalWorkouts > 0 ? (totalSets / totalWorkouts).toFixed(1) : '0.0';

  const progression = useMemo(() => {
    const byExercise: Record<number, WorkoutSetResponse[]> = {};

    workouts.forEach((workout) => {
      (workout.sets ?? []).forEach((set) => {
        if (!byExercise[set.exercise_id]) byExercise[set.exercise_id] = [];
        byExercise[set.exercise_id].push(set);
      });
    });

    let improving = 0;
    let stable = 0;
    let regressing = 0;

    Object.values(byExercise).forEach((sets) => {
      if (sets.length < 2) return;
      const latest = sets[sets.length - 1];
      const prev = sets[sets.length - 2];

      const latestScore = latest.weight * latest.reps;
      const prevScore = prev.weight * prev.reps;

      if (latestScore > prevScore) improving += 1;
      else if (latestScore < prevScore) regressing += 1;
      else stable += 1;
    });

    return { improving, stable, regressing };
  }, [workouts]);

  const bmi = calcBmi(Number(weightKg), Number(heightCm));
  const bmiLabel = bmi ? bmiCategory(bmi) : 'Enter valid numbers';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E8522A" />
        <Text style={styles.loadingText}>Loading profile metrics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile.</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <Text style={styles.userName}>{user?.username || 'Athlete'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
        <Text style={styles.userJoinDate}>Member since {memberSince}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalSets}</Text>
          <Text style={styles.statLabel}>Total Sets</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{avgSetsPerWorkout}</Text>
          <Text style={styles.statLabel}>Sets/Workout</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>BMI Calculator</Text>

        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="decimal-pad"
              placeholder="175"
              placeholderTextColor="#52576B"
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
              placeholder="75"
              placeholderTextColor="#52576B"
            />
          </View>
        </View>

        <View style={styles.bmiResultBox}>
          <Text style={styles.bmiValue}>{bmi ? bmi.toFixed(1) : '--'}</Text>
          <Text style={styles.bmiLabel}>{bmiLabel}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Progression Summary</Text>
        <Text style={styles.progressLine}>Improving exercises: {progression.improving}</Text>
        <Text style={styles.progressLine}>Stable exercises: {progression.stable}</Text>
        <Text style={styles.progressLine}>Regressing exercises: {progression.regressing}</Text>
        <Text style={styles.progressHint}>
          Logic uses set performance score (weight x reps) between the two most recent sets per exercise.
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const BG = '#0D0E12';
const CARD_BG = '#15171D';
const BORDER = '#1E2028';
const ACCENT = '#E8522A';
const TEXT_PRIMARY = '#F5F0E8';
const TEXT_SECONDARY = '#52576B';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  loadingText: { marginTop: 10, color: TEXT_SECONDARY },

  header: { marginTop: 8, marginBottom: 24 },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 36, fontWeight: '900', letterSpacing: -1 },

  profileCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    padding: 20,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 4,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  avatarText: { color: ACCENT, fontSize: 24, fontWeight: '800' },
  userName: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  userEmail: { color: TEXT_SECONDARY, fontSize: 13, marginBottom: 4 },
  userJoinDate: { color: TEXT_SECONDARY, fontSize: 12 },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { color: TEXT_SECONDARY, fontSize: 10, marginTop: 3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  sectionCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { color: TEXT_SECONDARY, fontWeight: '700', fontSize: 10, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.2 },

  inputRow: { flexDirection: 'row', gap: 10 },
  inputWrap: { flex: 1 },
  inputLabel: { color: TEXT_SECONDARY, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    color: TEXT_PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bmiResultBox: {
    marginTop: 12,
    backgroundColor: BG,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    alignItems: 'center',
  },
  bmiValue: { color: TEXT_PRIMARY, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  bmiLabel: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 4 },

  progressLine: { color: TEXT_PRIMARY, fontSize: 14, marginBottom: 6 },
  progressHint: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 8, lineHeight: 18 },

  logoutBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
