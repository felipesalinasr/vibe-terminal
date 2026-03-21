export interface HealthResponse {
  status: string
  uptime: number
  sessions: number
  activeSessions: number
}

export type AutocompleteResponse = string[]

export interface BrowseResponse {
  path: string | null
}

export interface ImportAgentResponse {
  name: string
  purpose: string
  skills: string[]
  defaultCwd: string
}

export interface DropResponse {
  path: string
}

export interface ExternalSkill {
  name: string
  repo: string
  installCommand: string
}
