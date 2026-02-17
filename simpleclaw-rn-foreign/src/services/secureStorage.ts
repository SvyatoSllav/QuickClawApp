import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'auth_token';
const HAS_ONBOARDED_KEY = 'has_onboarded';

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

export async function getHasOnboarded(): Promise<boolean> {
  const value = await getItem(HAS_ONBOARDED_KEY);
  return value === 'true';
}

export async function setHasOnboarded(): Promise<void> {
  await setItem(HAS_ONBOARDED_KEY, 'true');
}
