import apiClient from './client';
import { ServerStatus, ServerPool, serverStatusFromJson, serverPoolFromJson } from '../types/server';

export async function getServerStatus(): Promise<ServerStatus> {
  const response = await apiClient.get('/server/status/');
  return serverStatusFromJson(response.data);
}

export async function getServerPool(): Promise<ServerPool> {
  const response = await apiClient.get('/server/pool/');
  return serverPoolFromJson(response.data);
}
