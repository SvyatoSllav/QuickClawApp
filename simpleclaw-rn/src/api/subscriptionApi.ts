import apiClient from './client';
import { SubscriptionData, subscriptionFromJson } from '../types/subscription';

export async function getSubscriptionStatus(): Promise<SubscriptionData> {
  const response = await apiClient.get('/subscription/');
  return subscriptionFromJson(response.data);
}

export async function cancelSubscription(params: { immediate?: boolean } = {}): Promise<void> {
  await apiClient.post('/subscription/cancel/', { immediate: params.immediate ?? false });
}

export async function reactivateSubscription(): Promise<void> {
  await apiClient.post('/subscription/reactivate/');
}
