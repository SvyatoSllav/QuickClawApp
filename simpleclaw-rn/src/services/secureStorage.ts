import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'auth_token';
const PENDING_TELEGRAM_TOKEN_KEY = 'pending_telegram_token';

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(key);
}

export async function getAuthToken(): Promise<string | null> {
  return getItem(AUTH_TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await setItem(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await deleteItem(AUTH_TOKEN_KEY);
}

export async function getPendingTelegramToken(): Promise<string | null> {
  return getItem(PENDING_TELEGRAM_TOKEN_KEY);
}

export async function setPendingTelegramToken(token: string): Promise<void> {
  await setItem(PENDING_TELEGRAM_TOKEN_KEY, token);
}

export async function clearPendingTelegramToken(): Promise<void> {
  await deleteItem(PENDING_TELEGRAM_TOKEN_KEY);
}
