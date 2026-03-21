import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Project {
  id: string
  name: string
  context: string
  createdAt: number
}

interface ProjectsState {
  projects: Project[]
  selectedProjectId: string | null

  addProject: (name: string) => Project
  removeProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  updateContext: (id: string, context: string) => void
  selectProject: (id: string | null) => void
}

function makeId(): string {
  return `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

const SEED_PROJECTS: Project[] = [
  {
    id: 'proj-seed-1',
    name: 'API Migration',
    context: '',
    createdAt: Date.now() - 86_400_000,
  },
  {
    id: 'proj-seed-2',
    name: 'Dashboard Redesign',
    context: '',
    createdAt: Date.now() - 43_200_000,
  },
  {
    id: 'proj-seed-3',
    name: 'Auth System',
    context: '',
    createdAt: Date.now(),
  },
]

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: SEED_PROJECTS,
      selectedProjectId: null,

      addProject: (name) => {
        const project: Project = {
          id: makeId(),
          name,
          context: '',
          createdAt: Date.now(),
        }
        set((s) => ({ projects: [...s.projects, project] }))
        return project
      },

      removeProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          selectedProjectId: s.selectedProjectId === id ? null : s.selectedProjectId,
        })),

      renameProject: (id, name) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

      updateContext: (id, context) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, context } : p)),
        })),

      selectProject: (id) => {
        const current = get().selectedProjectId
        set({ selectedProjectId: current === id ? null : id })
      },
    }),
    { name: 'vt-projects' },
  ),
)
