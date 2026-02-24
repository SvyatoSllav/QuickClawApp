import apiClient from './client';

export async function sendSupportMessage(message: string): Promise<void> {
  await apiClient.post('/support/', { message });
}
