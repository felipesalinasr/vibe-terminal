import { apiRequest } from './client.ts'
import type { AgentSkill, ContentResponse, ExternalSkill } from '@/types/index.ts'

export function listLocalSkills(): Promise<AgentSkill[]> {
  return apiRequest('/api/skills')
}

export function listExternalSkills(): Promise<ExternalSkill[]> {
  return apiRequest('/api/skills/external')
}

export function readSkillContent(path: string): Promise<ContentResponse> {
  return apiRequest(`/api/skill-content?path=${encodeURIComponent(path)}`)
}

export function writeSkillContent(path: string, content: string): Promise<void> {
  return apiRequest('/api/skill-content', {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  })
}
