/**
 * App-wide configuration.
 *
 * BASE_URL is resolved automatically from the Expo Metro bundler host so
 * it always points to the correct machine regardless of which network you
 * are connected to.  No manual IP editing required.
 *
 * How it works:
 *   - Expo stores the Metro server address in Constants.expoConfig.hostUri
 *     (e.g. "192.168.1.42:8081").  We strip the port and append :8000 to
 *     reach the FastAPI backend running on the same machine.
 *   - Falls back to localhost for iOS simulator / web.
 */
import Constants from 'expo-constants';

function getBaseUrl(): string {
  // Production backend on Render
  return 'https://workout-tracker-api-uoob.onrender.com/api/v1';
}

export const BASE_URL = getBaseUrl();
