import apiClient from './client';
import { AuthResponse, authResponseFromJson } from '../types/auth';

export async function signInWithGoogle(idToken: string): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/google/', { token: idToken });
  return authResponseFromJson(response.data);
}

export async function signInWithGoogleAccessToken(accessToken: string): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/google/', { access_token: accessToken });
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
