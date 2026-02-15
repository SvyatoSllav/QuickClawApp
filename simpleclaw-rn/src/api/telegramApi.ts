import apiClient from './client';
import { TelegramValidation, telegramValidationFromJson } from '../types/telegram';

export async function validateTelegramToken(token: string): Promise<TelegramValidation> {
  const response = await apiClient.post('/telegram/validate/', { token });
  return telegramValidationFromJson(response.data);
}
