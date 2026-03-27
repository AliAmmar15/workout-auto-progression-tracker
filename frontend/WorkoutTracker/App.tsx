import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import useAuthStore from './src/store/useAuthStore';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import WorkoutLogScreen from './src/screens/WorkoutLogScreen';
import WorkoutHistoryScreen from './src/screens/WorkoutHistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Log: '📝',
    History: '📋',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: focused ? 22 : 18 }}>
      {icons[label] ?? '•'}
    </Text>
  );
}

/**
 * Root App component.
 *
 * Auth gate: if no token is present in the Zustand store, renders AuthScreen.
 * Once the user logs in (token is set), the main tab navigator is shown.
 * Logging out (clearToken) returns to AuthScreen automatically via reactive state.
 */
export default function App() {
  const token = useAuthStore((s) => s.token);

  return (
    <SafeAreaProvider>
      {!token ? (
        // Not authenticated — show login / register
        <AuthScreen />
      ) : (
        // Authenticated — show the main app with tabs
        <NavigationContainer>
          <Tab.Navigator
            initialRouteName="Home"
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused }) => (
                <TabIcon label={route.name} focused={focused} />
              ),
              tabBarActiveTintColor: '#00d4aa',
              tabBarInactiveTintColor: '#555',
              tabBarStyle: {
                backgroundColor: '#0F0F1A',
                borderTopColor: '#1A1A2E',
                paddingBottom: 8,
                paddingTop: 8,
                height: 70,
              },
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
              },
              headerStyle: { backgroundColor: '#12151e' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            })}
          >
            <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Dashboard', headerShown: false }} />
            <Tab.Screen name="Log" component={WorkoutLogScreen} options={{ title: 'Log Workout' }} />
            <Tab.Screen name="History" component={WorkoutHistoryScreen} options={{ title: 'History' }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', headerShown: false }} />
          </Tab.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}
