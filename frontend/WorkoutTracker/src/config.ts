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
  // hostUri looks like "192.168.1.42:8081" — grab just the IP part
  const hostUri: string =
    (Constants.expoConfig?.hostUri as string | undefined) ?? '';
  const host = hostUri.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:8000/api/v1`;
  }
  // iOS simulator / web browser fallback
  return 'http://localhost:8000/api/v1';
}

export const BASE_URL = getBaseUrl();
