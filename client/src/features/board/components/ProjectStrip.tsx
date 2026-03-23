import { useProjectsStore } from '@/stores/projects.ts'
import { useUiStore } from '@/stores/ui.ts'
import { useSessions } from '@/hooks/useSessions.ts'
import { useBoardStore } from '@/stores/board.ts'
import { useProjects } from '@/hooks/useProjects.ts'
import css from './ProjectStrip.module.css'

export function ProjectStrip() {
  const { data: projects = [] } = useProjects()
  const selectedId = useProjectsStore((s) => s.selectedProjectId)
  const selectProject = useProjectsStore((s) => s.selectProject)
  const openContextEditor = useUiStore((s) => s.openContextEditor)
  const openModal = useUiStore((s) => s.openModal)
  const { data: sessions } = useSessions()
  const backlogTasks = useBoardStore((s) => s.backlogTasks)

  function countForProject(projectId: string): number {
    const sessionCount = sessions?.filter((s) => s.projectId === projectId).length ?? 0
    const backlogCount = backlogTasks.filter((t) => t.projectId === projectId).length
    return sessionCount + backlogCount
  }

  return (
    <div className={css.strip}>
      {/* All pill */}
      <button
        className={`${css.pill}${selectedId === null ? ` ${css.selected}` : ''}`}
        onClick={() => selectProject(null)}
      >
        All
      </button>

      {/* Project pills */}
      {projects.map((p) => {
        const count = countForProject(p.id)
        const isSelected = selectedId === p.id
        return (
          <button
            key={p.id}
            className={`${css.pill}${isSelected ? ` ${css.selected}` : ''}`}
            onClick={() => selectProject(p.id)}
          >
            {p.name}
            {count > 0 && <span className={css.count}>{count}</span>}
            <span
              className={css.contextBtn}
              onClick={(e) => {
                e.stopPropagation()
                openContextEditor(p.id)
              }}
              title="Edit shared context"
            >
              &#9881;
            </span>
          </button>
        )
      })}

      {/* Add new project */}
      <button className={css.addPill} onClick={() => openModal('createProject')}>
        + New Project
      </button>
    </div>
  )
}
