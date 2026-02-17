import apiClient from './client';

export async function cancelSubscription(params: { immediate?: boolean } = {}): Promise<void> {
  await apiClient.post('/subscription/cancel/', { immediate: params.immediate ?? false });
}
