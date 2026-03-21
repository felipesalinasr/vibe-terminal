import { apiRequest } from './client.ts'
import { API } from './paths.ts'
import type { AgentSkill, ContentResponse, ExternalSkill } from '@/types/index.ts'

export function listLocalSkills(): Promise<AgentSkill[]> {
  return apiRequest(API.skills)
}

export function listExternalSkills(): Promise<ExternalSkill[]> {
  return apiRequest(API.skillsExternal)
}

export function readSkillContent(path: string): Promise<ContentResponse> {
  return apiRequest(`${API.skillContent}?path=${encodeURIComponent(path)}`)
}

export function writeSkillContent(path: string, content: string): Promise<void> {
  return apiRequest(API.skillContent, {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  })
}
