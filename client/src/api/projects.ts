import { apiRequest } from './client.ts'
import { API } from './paths.ts'
import type { Project, CreateProjectInput, UpdateProjectInput, SetupProjectInput, SetupProjectResult, GitHubStatus } from '@/types/index.ts'

export function listProjects(): Promise<Project[]> {
  return apiRequest(API.projects)
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return apiRequest(API.projects, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  return apiRequest(API.project(id), {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteProject(id: string): Promise<void> {
  return apiRequest(API.project(id), { method: 'DELETE' })
}

export function setupProject(id: string, input: SetupProjectInput): Promise<SetupProjectResult> {
  return apiRequest(API.projectSetup(id), {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getGitHubStatus(): Promise<GitHubStatus> {
  return apiRequest(API.githubStatus)
}
