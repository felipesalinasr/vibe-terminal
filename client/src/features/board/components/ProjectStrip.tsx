import { useState, useRef, useEffect } from 'react'
import { useProjectsStore } from '@/stores/projects.ts'
import { useUiStore } from '@/stores/ui.ts'
import { useSessions } from '@/hooks/useSessions.ts'
import { useBoardStore } from '@/stores/board.ts'
import css from './ProjectStrip.module.css'

export function ProjectStrip() {
  const projects = useProjectsStore((s) => s.projects)
  const selectedId = useProjectsStore((s) => s.selectedProjectId)
  const selectProject = useProjectsStore((s) => s.selectProject)
  const addProject = useProjectsStore((s) => s.addProject)
  const openContextEditor = useUiStore((s) => s.openContextEditor)
  const { data: sessions } = useSessions()
  const backlogTasks = useBoardStore((s) => s.backlogTasks)

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) {
      inputRef.current?.focus()
    }
  }, [adding])

  function handleAdd() {
    const trimmed = newName.trim()
    if (trimmed) {
      addProject(trimmed)
    }
    setNewName('')
    setAdding(false)
  }

  function countForProject(projectId: string): number {
    const sessionCount = sessions?.filter((s) => {
      const task = backlogTasks.find((t) => t.name === s.name)
      return task?.projectId === projectId
    }).length ?? 0
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
      {adding ? (
        <input
          ref={inputRef}
          className={css.nameInput}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
            if (e.key === 'Escape') { setAdding(false); setNewName('') }
          }}
          onBlur={handleAdd}
          placeholder="project name"
        />
      ) : (
        <button className={css.addPill} onClick={() => setAdding(true)}>
          + New Project
        </button>
      )}
    </div>
  )
}
