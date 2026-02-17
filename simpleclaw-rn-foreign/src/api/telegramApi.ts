import apiClient from './client';

export interface ValidateTokenResponse {
  valid: boolean;
  bot_username?: string;
  bot_name?: string;
}

export interface ApprovePairingResponse {
  approved: boolean;
  error?: string;
}

export async function validateTelegramToken(token: string): Promise<ValidateTokenResponse> {
  const response = await apiClient.post('/telegram/validate/', { token });
  return response.data;
}

export async function removeTelegramBot(): Promise<void> {
  await apiClient.delete('/telegram/validate/');
}

export async function approvePairingCode(code: string): Promise<ApprovePairingResponse> {
  const response = await apiClient.post('/telegram/approve-pairing/', { code });
  return response.data;
}
