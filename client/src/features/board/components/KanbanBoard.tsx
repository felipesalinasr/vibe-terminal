import { useCallback, useState } from 'react'
import { useSessions } from '@/hooks/useSessions.ts'
import { useBoardStore } from '@/stores/board.ts'
import { useProjectsStore } from '@/stores/projects.ts'
import { useProjects } from '@/hooks/useProjects.ts'
import { SessionCard, BacklogCard } from './KanbanCard.tsx'
import type { SessionSummary, SessionStatus } from '@/types/index.ts'
import css from './KanbanBoard.module.css'

/* ── Column definitions ── */

interface ColumnDef {
  id: string
  label: string
  statuses: SessionStatus[]
}

const COLUMNS: ColumnDef[] = [
  { id: 'backlog', label: 'Backlog', statuses: [] },
  { id: 'active', label: 'In Progress', statuses: ['active'] },
  { id: 'review', label: 'Review', statuses: ['review'] },
  { id: 'done', label: 'Done', statuses: ['done', 'historical'] },
]

/* ── Drop handler logic ── */

// Manual column overrides are stored in local state since the server
// doesn't support arbitrary status transitions. In a real app this
// would call an API. For now, session cards just snap to the column.
type OverrideMap = Record<string, string>

export function KanbanBoard() {
  const { data: sessions } = useSessions()
  const backlogTasks = useBoardStore((s) => s.backlogTasks)
  const removeTask = useBoardStore((s) => s.removeTask)
  const selectedProjectId = useProjectsStore((s) => s.selectedProjectId)
  const { data: projects = [] } = useProjects()

  const [overrides, setOverrides] = useState<OverrideMap>({})
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  /* Resolve which column a session belongs to */
  function sessionColumn(session: SessionSummary): string {
    if (overrides[session.id]) return overrides[session.id]
    if (session.status === 'active') return 'active'
    if (session.status === 'review') return 'review'
    return 'done'
  }

  const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, colId: string) => {
      e.preventDefault()
      setDragOverCol(null)
      const cardId = e.dataTransfer.getData('text/plain')
      if (!cardId) return

      // Backlog card dropped into a non-backlog column: remove from backlog
      if (cardId.startsWith('backlog-') && colId !== 'backlog') {
        const backlogId = Number(cardId.replace('backlog-', ''))
        if (!Number.isNaN(backlogId)) {
          removeTask(backlogId)
        }
        return
      }

      // Session card — set manual column override
      if (!cardId.startsWith('backlog-')) {
        setOverrides((prev) => ({ ...prev, [cardId]: colId }))
      }
    },
    [removeTask],
  )

  /* ── Helpers ── */

  function projectName(projectId: string | undefined | null): string | undefined {
    if (!projectId) return undefined
    return projects.find((p) => p.id === projectId)?.name
  }

  /* ── Render ── */

  const sessionList = sessions ?? []

  // Filter by selected project
  const filteredBacklog = selectedProjectId
    ? backlogTasks.filter((t) => t.projectId === selectedProjectId)
    : backlogTasks

  const filteredSessions = selectedProjectId
    ? sessionList.filter((s) => s.projectId === selectedProjectId)
    : sessionList

  // Show project tags only when viewing all projects
  const showProjectTags = selectedProjectId === null

  return (
    <div className={css.board}>
      {COLUMNS.map((col) => {
        const isBacklog = col.id === 'backlog'
        const colSessions = isBacklog
          ? []
          : filteredSessions.filter((s) => sessionColumn(s) === col.id)
        const totalCount = isBacklog ? filteredBacklog.length : colSessions.length

        return (
          <div className={css.column} key={col.id} data-col={col.id}>
            <div className={css.columnHeader}>
              <span className={css.columnTitle}>{col.label}</span>
              <span className={css.columnCount}>{totalCount}</span>
            </div>
            <div
              className={`${css.columnBody}${dragOverCol === col.id ? ` ${css.dragOver}` : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {isBacklog
                ? filteredBacklog.map((task) => (
                    <BacklogCard
                      key={task.id}
                      task={task}
                      projectName={showProjectTags ? projectName(task.projectId) : undefined}
                    />
                  ))
                : colSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      columnStatus={col.id as 'active' | 'review' | 'done'}
                      projectName={showProjectTags ? projectName(session.projectId) : undefined}
                    />
                  ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
