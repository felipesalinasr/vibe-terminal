export interface AgentConfig {
  id: string
  name: string
  skills: string[]
  tools: string[]
  files: string[]
  createdAt: number
  updatedAt: number
}

export interface AgentConfigResponse {
  config: AgentConfig
  purpose: string
}

export interface ContentResponse {
  content: string
}

export interface AgentSkill {
  folder: string
  name: string
  description?: string
  path?: string
  sourceAgent?: string
  sourceCwd?: string
}

export interface KnowledgeFile {
  name: string
  size: number
  path: string
}

export interface MemoryEntry {
  type: string
  content: string
  ts: string
  [key: string]: unknown
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  ts: string
  [key: string]: unknown
}
