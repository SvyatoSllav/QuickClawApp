import apiClient from './client';
import { AuthResponse, authResponseFromJson } from '../types/auth';
import type { GoogleUserInfo } from '../services/googleAuth';

export async function signInWithGoogle(idToken: string): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/google/', { token: idToken });
  return authResponseFromJson(response.data);
}

export async function signInWithGoogleUserInfo(userInfo: GoogleUserInfo): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/google/', {
    email: userInfo.email,
    name: userInfo.name,
    google_id: userInfo.google_id,
    avatar_url: userInfo.avatar_url,
  });
  return authResponseFromJson(response.data);
}

export async function signInWithApple(
  identityToken: string,
  name?: string | null,
): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/apple/', {
    token: identityToken,
    name: name || '',
  });
  return authResponseFromJson(response.data);
}

export async function logoutFromBackend(): Promise<void> {
  try {
    await apiClient.post('/auth/logout/');
  } catch {
    // Token might already be invalid; ignore errors.
  }
}
