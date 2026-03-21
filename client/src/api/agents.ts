import { apiRequest } from './client.ts'
import type {
  AgentConfigResponse,
  ContentResponse,
  AgentSkill,
  KnowledgeFile,
  MemoryEntry,
  AuditEntry,
} from '@/types/index.ts'

export function getAgent(sessionId: string): Promise<AgentConfigResponse> {
  return apiRequest(`/api/agents/${sessionId}`)
}

export function updateAgent(sessionId: string, updates: Record<string, unknown>): Promise<void> {
  return apiRequest(`/api/agents/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export function updatePurpose(sessionId: string, content: string): Promise<void> {
  return apiRequest(`/api/agents/${sessionId}/purpose`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export function getConstraints(sessionId: string): Promise<ContentResponse> {
  return apiRequest(`/api/agents/${sessionId}/agents-md`)
}

export function updateConstraints(sessionId: string, content: string): Promise<void> {
  return apiRequest(`/api/agents/${sessionId}/agents-md`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export function getSkills(sessionId: string): Promise<AgentSkill[]> {
  return apiRequest(`/api/agents/${sessionId}/skills`)
}

export function getSkill(sessionId: string, folder: string): Promise<ContentResponse> {
  return apiRequest(`/api/agents/${sessionId}/skills/${folder}`)
}

export function writeSkill(sessionId: string, folder: string, content: string): Promise<void> {
  return apiRequest(`/api/agents/${sessionId}/skills/${folder}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export function addFile(sessionId: string, path: string): Promise<void> {
  return apiRequest(`/api/agents/${sessionId}/files`, {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
}

export function removeFile(sessionId: string, path: string): Promise<void> {
  return apiRequest(`/api/agents/${sessionId}/files`, {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  })
}

export function getKnowledge(sessionId: string): Promise<KnowledgeFile[]> {
  return apiRequest(`/api/agents/${sessionId}/knowledge`)
}

export function uploadKnowledge(sessionId: string, file: File): Promise<void> {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest(`/api/agents/${sessionId}/knowledge`, {
    method: 'POST',
    body: formData,
  })
}

export function deleteKnowledge(sessionId: string, filename: string): Promise<void> {
  return apiRequest(`/api/agents/${sessionId}/knowledge/${filename}`, {
    method: 'DELETE',
  })
}

export function getMemory(sessionId: string): Promise<MemoryEntry[]> {
  return apiRequest(`/api/agents/${sessionId}/memory`)
}

export function getAudit(sessionId: string): Promise<AuditEntry[]> {
  return apiRequest(`/api/agents/${sessionId}/audit`)
}
