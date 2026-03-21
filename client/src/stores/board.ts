import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BacklogTask } from '@/types/index.ts'

interface BoardState {
  backlogTasks: BacklogTask[]
  nextBacklogId: number
  addTask: (task: Omit<BacklogTask, 'id'>) => BacklogTask
  removeTask: (id: number) => void
  renameTask: (id: number, name: string) => void
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      backlogTasks: [],
      nextBacklogId: 1,
      addTask: (task) => {
        const id = get().nextBacklogId
        const newTask = { ...task, id }
        set((state) => ({
          backlogTasks: [...state.backlogTasks, newTask],
          nextBacklogId: state.nextBacklogId + 1,
        }))
        return newTask
      },
      removeTask: (id) =>
        set((state) => ({
          backlogTasks: state.backlogTasks.filter((t) => t.id !== id),
        })),
      renameTask: (id, name) =>
        set((state) => ({
          backlogTasks: state.backlogTasks.map((t) =>
            t.id === id ? { ...t, name } : t,
          ),
        })),
    }),
    {
      name: 'vt-backlog',
    },
  ),
)
