import apiClient from './client';
import { UserData, userFromJson } from '../types/auth';
import { UsageData, usageFromJson } from '../types/usage';

export async function getProfile(): Promise<UserData> {
  const response = await apiClient.get('/profile/');
  return userFromJson(response.data);
}

export async function getUsage(): Promise<UsageData> {
  const response = await apiClient.get('/profile/usage/');
  return usageFromJson(response.data);
}
