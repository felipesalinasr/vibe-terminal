import { create } from 'zustand'

interface ProjectsUiState {
  selectedProjectId: string | null
  selectProject: (id: string | null) => void
}

export const useProjectsStore = create<ProjectsUiState>()((set, get) => ({
  selectedProjectId: null,

  selectProject: (id) => {
    const current = get().selectedProjectId
    set({ selectedProjectId: current === id ? null : id })
  },
}))
