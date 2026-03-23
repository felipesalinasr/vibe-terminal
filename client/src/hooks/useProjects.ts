import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as projectsApi from '@/api/projects.ts'
import type { CreateProjectInput, UpdateProjectInput, SetupProjectInput } from '@/types/index.ts'

export const projectKeys = {
  all: ['projects'] as const,
  githubStatus: ['github-status'] as const,
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: projectsApi.listProjects,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.createProject(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      projectsApi.updateProject(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

export function useGitHubStatus() {
  return useQuery({
    queryKey: projectKeys.githubStatus,
    queryFn: projectsApi.getGitHubStatus,
  })
}

export function useSetupProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SetupProjectInput }) =>
      projectsApi.setupProject(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}
