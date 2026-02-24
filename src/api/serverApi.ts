import apiClient from './client';
import { ServerStatus, serverStatusFromJson } from '../types/server';

export async function getServerStatus(): Promise<ServerStatus> {
  const response = await apiClient.get('/server/status/');
  return serverStatusFromJson(response.data);
}
