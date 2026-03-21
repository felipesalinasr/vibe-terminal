import { apiRequest } from './client.ts'
import { API } from './paths.ts'
import type { SessionSummary, SessionDetail, CreateSessionInput, ScrollbackResponse } from '@/types/index.ts'

export function listSessions(): Promise<SessionSummary[]> {
  return apiRequest(API.sessions)
}

export function getSession(id: string): Promise<SessionDetail> {
  return apiRequest(API.session(id))
}

export function createSession(input: CreateSessionInput): Promise<SessionSummary> {
  return apiRequest(API.sessions, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteSession(id: string): Promise<void> {
  return apiRequest(API.session(id), { method: 'DELETE' })
}

export function getScrollback(id: string, offset = 0): Promise<ScrollbackResponse> {
  return apiRequest(`${API.scrollback(id)}?offset=${offset}`)
}
