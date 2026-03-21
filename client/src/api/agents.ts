import { apiRequest } from './client.ts'
import { API } from './paths.ts'
import type {
  AgentConfigResponse,
  ContentResponse,
  AgentSkill,
  KnowledgeFile,
  MemoryEntry,
  AuditEntry,
} from '@/types/index.ts'

export function getAgent(sessionId: string): Promise<AgentConfigResponse> {
  return apiRequest(API.agent(sessionId))
}

export function updateAgent(sessionId: string, updates: Record<string, unknown>): Promise<void> {
  return apiRequest(API.agent(sessionId), {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export function updatePurpose(sessionId: string, content: string): Promise<void> {
  return apiRequest(API.agentPurpose(sessionId), {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export function getConstraints(sessionId: string): Promise<ContentResponse> {
  return apiRequest(API.agentAgentsMd(sessionId))
}

export function updateConstraints(sessionId: string, content: string): Promise<void> {
  return apiRequest(API.agentAgentsMd(sessionId), {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export function getSkills(sessionId: string): Promise<AgentSkill[]> {
  return apiRequest(API.agentSkills(sessionId))
}

export function getSkill(sessionId: string, folder: string): Promise<ContentResponse> {
  return apiRequest(API.agentSkill(sessionId, folder))
}

export function writeSkill(sessionId: string, folder: string, content: string): Promise<void> {
  return apiRequest(API.agentSkill(sessionId, folder), {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export function addFile(sessionId: string, path: string): Promise<void> {
  return apiRequest(API.agentFiles(sessionId), {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
}

export function removeFile(sessionId: string, path: string): Promise<void> {
  return apiRequest(API.agentFiles(sessionId), {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  })
}

export function getKnowledge(sessionId: string): Promise<KnowledgeFile[]> {
  return apiRequest(API.agentKnowledge(sessionId))
}

export function uploadKnowledge(sessionId: string, file: File): Promise<void> {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest(API.agentKnowledge(sessionId), {
    method: 'POST',
    body: formData,
  })
}

export function deleteKnowledge(sessionId: string, filename: string): Promise<void> {
  return apiRequest(API.agentKbFile(sessionId, filename), {
    method: 'DELETE',
  })
}

export function getMemory(sessionId: string): Promise<MemoryEntry[]> {
  return apiRequest(API.agentMemory(sessionId))
}

export function getAudit(sessionId: string): Promise<AuditEntry[]> {
  return apiRequest(API.agentAudit(sessionId))
}
