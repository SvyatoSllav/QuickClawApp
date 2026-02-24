import apiClient from './client';
import { ServerStatus, serverStatusFromJson } from '../types/server';

export async function getServerStatus(): Promise<ServerStatus> {
  const response = await apiClient.get('/server/status/');
  return serverStatusFromJson(response.data);
}

export async function installSkill(skillName: string, githubUrl: string): Promise<void> {
  await apiClient.post('/server/skills/install/', {
    skill_name: skillName,
    github_url: githubUrl,
  });
}

export async function uninstallSkill(skillName: string): Promise<void> {
  await apiClient.post('/server/skills/uninstall/', {
    skill_name: skillName,
  });
}
