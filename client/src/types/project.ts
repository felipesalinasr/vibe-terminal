export interface Project {
  id: string
  name: string
  description: string
  path: string
  context: string
  techStack: TechStack | null
  repoUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface TechStack {
  lang: string
  framework?: string
  buildCmd?: string
  devCmd?: string
  testCmd?: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  path?: string
}

export interface UpdateProjectInput {
  name?: string
  context?: string
}

export interface SetupProjectInput {
  createRepo?: boolean
  repoPrivate?: boolean
}

export interface SetupProjectResult {
  filesWritten: string[]
  techStack: TechStack | null
  repoUrl: string | null
  gitInitialized: boolean
}

export interface GitHubStatus {
  available: boolean
  username?: string
}
