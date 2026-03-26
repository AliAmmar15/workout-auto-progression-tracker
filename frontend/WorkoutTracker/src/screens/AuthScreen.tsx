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

type Mode = 'login' | 'register';

/**
 * AuthScreen — login and registration form.
 * On success, stores the JWT via Zustand so all other screens can make
 * authenticated requests.
 */
export default function AuthScreen() {
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        // After registering, log in automatically
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.appName}>💪 WorkoutTracker</Text>
        <Text style={styles.subtitle}>Progression-based strength training</Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
            onPress={() => { setMode('login'); setError(null); }}
          >
            <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'register' && styles.toggleBtnActive]}
            onPress={() => { setMode('register'); setError(null); }}
          >
            <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>Register</Text>
          </TouchableOpacity>
        </View>

        {mode === 'register' && (
          <>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="your_name"
              placeholderTextColor="#555"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#555"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#555"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#14142A',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    marginBottom: 28,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#0F0F1A',
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#6C63FF' },
  toggleText: { color: '#555', fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: 12, color: '#888', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0F0F1A',
    borderRadius: 10,
    padding: 13,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
