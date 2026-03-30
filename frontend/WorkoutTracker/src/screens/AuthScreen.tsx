import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import useAuthStore from '../store/useAuthStore';
import { login, register, UserResponse } from '../services/api';

const C = {
  bg:      '#0D0E12',
  surface: '#15171D',
  accent:  '#E8522A',
  warm:    '#F5F0E8',
  muted:   '#52576B',
  divider: '#1E2028',
  error:   '#E84A4A',
};

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const setToken = useAuthStore((s) => s.setToken);
  const setUser  = useAuthStore((s) => s.setUser);

  const [mode,     setMode]     = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email || !password || (mode === 'register' && !username)) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const tokenResp = await login(email, password);
        setToken(tokenResp.access_token);
      } else {
        const userResp: UserResponse = await register(username, email, password);
        const tokenResp = await login(email, password);
        setToken(tokenResp.access_token);
        setUser({ id: userResp.id, username: userResp.username, email: userResp.email });
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Check backend is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.inner}>

        {/* ── Brand block ── */}
        <View style={s.brandBlock}>
          <Text style={s.wordmark}>Workout{'\n'}Tracker.</Text>
          <Text style={s.tagline}>Strength built on data.</Text>
        </View>

        {/* ── Mode toggle ── */}
        <View style={s.toggleRow}>
          <TouchableOpacity
            style={[s.toggleBtn, mode === 'login' && s.toggleBtnActive]}
            onPress={() => { setMode('login'); setError(null); }}
          >
            <Text style={[s.toggleText, mode === 'login' && s.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, mode === 'register' && s.toggleBtnActive]}
            onPress={() => { setMode('register'); setError(null); }}
          >
            <Text style={[s.toggleText, mode === 'register' && s.toggleTextActive]}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* ── Fields ── */}
        {mode === 'register' && (
          <>
            <Text style={s.label}>USERNAME</Text>
            <TextInput
              style={s.input}
              placeholder="your_handle"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          </>
        )}

        <Text style={s.label}>EMAIL</Text>
        <TextInput
          style={s.input}
          placeholder="you@example.com"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={s.label}>PASSWORD</Text>
        <TextInput
          style={s.input}
          placeholder="••••••••"
          placeholderTextColor={C.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color={C.warm} />
            : <Text style={s.submitText}>{mode === 'login' ? 'Sign In →' : 'Create Account →'}</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, justifyContent: 'center' },
  inner:  { paddingHorizontal: 28, paddingVertical: 32 },

  // Brand
  brandBlock: { marginBottom: 48 },
  wordmark:   { color: C.warm, fontSize: 48, fontWeight: '900', lineHeight: 50, letterSpacing: -2 },
  tagline:    { color: C.muted, fontSize: 13, marginTop: 10, letterSpacing: 0.5 },

  // Toggle
  toggleRow:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.divider, marginBottom: 28 },
  toggleBtn:       { paddingVertical: 10, paddingHorizontal: 4, marginRight: 24 },
  toggleBtnActive: { borderBottomWidth: 2, borderBottomColor: C.accent },
  toggleText:      { color: C.muted, fontWeight: '600', fontSize: 14 },
  toggleTextActive:{ color: C.warm, fontWeight: '700' },

  // Fields
  label: {
    color: C.muted, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, marginTop: 16,
  },
  input: {
    backgroundColor: C.surface, borderRadius: 4,
    paddingVertical: 14, paddingHorizontal: 14,
    color: C.warm, fontSize: 15,
    borderWidth: 1, borderColor: C.divider,
  },

  error: { color: C.error, fontSize: 13, marginTop: 14 },

  // CTA
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 4,
    paddingVertical: 16, alignItems: 'center', marginTop: 28,
  },
  submitText: { color: C.warm, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
