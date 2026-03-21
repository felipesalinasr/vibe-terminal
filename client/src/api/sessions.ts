import { apiRequest } from './client.ts'
import type { SessionSummary, SessionDetail, CreateSessionInput, ScrollbackResponse } from '@/types/index.ts'

export function listSessions(): Promise<SessionSummary[]> {
  return apiRequest('/api/sessions')
}

export function getSession(id: string): Promise<SessionDetail> {
  return apiRequest(`/api/sessions/${id}`)
}

export function createSession(input: CreateSessionInput): Promise<SessionSummary> {
  return apiRequest('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteSession(id: string): Promise<void> {
  return apiRequest(`/api/sessions/${id}`, { method: 'DELETE' })
}

export function getScrollback(id: string, offset = 0): Promise<ScrollbackResponse> {
  return apiRequest(`/api/sessions/${id}/scrollback?offset=${offset}`)
}
