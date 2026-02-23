import { Platform } from 'react-native';
import { AppConfig } from '../config/appConfig';
import { getAuthToken } from './secureStorage';

/** Fire-and-forget remote logger for critical WS events.
 *  Logs are POSTed to backend so we can debug iOS production issues. */
export async function remoteLog(level: 'info' | 'warn' | 'error', tag: string, message: string, extra?: Record<string, any>) {
  try {
    const token = await getAuthToken();
    fetch(`${AppConfig.apiBaseUrl}/client-log/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      body: JSON.stringify({
        level,
        tag,
        message,
        platform: Platform.OS,
        ts: new Date().toISOString(),
        ...extra,
      }),
    }).catch(() => {}); // swallow network errors — logging should never break the app
  } catch {
    // ignore
  }
}
