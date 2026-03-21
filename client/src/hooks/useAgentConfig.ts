import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as agentsApi from '@/api/agents.ts'

export const agentKeys = {
  config: (id: string) => ['agent', id] as const,
  constraints: (id: string) => ['agent', id, 'constraints'] as const,
  skills: (id: string) => ['agent', id, 'skills'] as const,
  skill: (id: string, folder: string) => ['agent', id, 'skills', folder] as const,
  knowledge: (id: string) => ['agent', id, 'knowledge'] as const,
  memory: (id: string) => ['agent', id, 'memory'] as const,
  audit: (id: string) => ['agent', id, 'audit'] as const,
}

export function useAgentConfig(sessionId: string | null) {
  return useQuery({
    queryKey: agentKeys.config(sessionId!),
    queryFn: () => agentsApi.getAgent(sessionId!),
    enabled: !!sessionId,
  })
}

export function useAgentConstraints(sessionId: string | null) {
  return useQuery({
    queryKey: agentKeys.constraints(sessionId!),
    queryFn: () => agentsApi.getConstraints(sessionId!),
    enabled: !!sessionId,
  })
}

export function useUpdatePurpose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      agentsApi.updatePurpose(sessionId, content),
    onSuccess: (_data, { sessionId }) =>
      qc.invalidateQueries({ queryKey: agentKeys.config(sessionId) }),
  })
}

export function useUpdateConstraints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      agentsApi.updateConstraints(sessionId, content),
    onSuccess: (_data, { sessionId }) =>
      qc.invalidateQueries({ queryKey: agentKeys.constraints(sessionId) }),
  })
}

export function useUpdateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, updates }: { sessionId: string; updates: Record<string, unknown> }) =>
      agentsApi.updateAgent(sessionId, updates),
    onSuccess: (_data, { sessionId }) =>
      qc.invalidateQueries({ queryKey: agentKeys.config(sessionId) }),
  })
}

export function useAgentSkills(sessionId: string | null) {
  return useQuery({
    queryKey: agentKeys.skills(sessionId!),
    queryFn: () => agentsApi.getSkills(sessionId!),
    enabled: !!sessionId,
  })
}

export function useAgentKnowledge(sessionId: string | null) {
  return useQuery({
    queryKey: agentKeys.knowledge(sessionId!),
    queryFn: () => agentsApi.getKnowledge(sessionId!),
    enabled: !!sessionId,
  })
}

export function useAgentMemory(sessionId: string | null) {
  return useQuery({
    queryKey: agentKeys.memory(sessionId!),
    queryFn: () => agentsApi.getMemory(sessionId!),
    enabled: !!sessionId,
  })
}

export function useAgentAudit(sessionId: string | null) {
  return useQuery({
    queryKey: agentKeys.audit(sessionId!),
    queryFn: () => agentsApi.getAudit(sessionId!),
    enabled: !!sessionId,
  })
}
