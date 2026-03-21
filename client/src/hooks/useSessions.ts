import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as sessionsApi from '@/api/sessions.ts'
import type { CreateSessionInput } from '@/types/index.ts'

export const sessionKeys = {
  all: ['sessions'] as const,
  detail: (id: string) => ['sessions', id] as const,
  scrollback: (id: string) => ['sessions', id, 'scrollback'] as const,
}

export function useSessions() {
  return useQuery({
    queryKey: sessionKeys.all,
    queryFn: sessionsApi.listSessions,
    refetchInterval: 10_000,
  })
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: sessionKeys.detail(id!),
    queryFn: () => sessionsApi.getSession(id!),
    enabled: !!id,
  })
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSessionInput) => sessionsApi.createSession(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sessionsApi.deleteSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  })
}
