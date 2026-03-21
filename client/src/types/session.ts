export type SessionStatus = 'active' | 'review' | 'done' | 'historical'

export interface SessionSummary {
  id: string
  name: string
  cwd: string
  status: SessionStatus
  pid: number | null
  createdAt: number
  endedAt?: number | null
}

export interface SessionDetail extends SessionSummary {
  scrollback: string[]
}

export interface CreateSessionInput {
  name: string
  cwd?: string
  templateId?: string
}

export interface ScrollbackResponse {
  data: string
  offset: number
  total: number
}

export interface BacklogTask {
  id: number
  name: string
  tag?: string
  templateId?: string
  projectId?: string
}
