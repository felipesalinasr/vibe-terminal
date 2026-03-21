import { useState, useRef, useCallback } from 'react'
import { useUiStore } from '@/stores/ui.ts'
import { useBoardStore } from '@/stores/board.ts'
import type { SessionSummary, SessionStatus, BacklogTask } from '@/types/index.ts'
import css from './KanbanCard.module.css'

/* ── Helpers ── */

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function statusDotClass(status: SessionStatus | 'idle'): string {
  switch (status) {
    case 'active': return css.statusRunning
    case 'review': return css.statusPaused
    case 'done': return css.statusDone
    case 'historical': return css.statusHistorical
    default: return css.statusIdle
  }
}

/* ── Drag helpers ── */

function handleDragStart(e: React.DragEvent, id: string) {
  e.dataTransfer.setData('text/plain', id)
  e.dataTransfer.effectAllowed = 'move'
  const target = e.currentTarget as HTMLElement
  target.classList.add(css.dragging)
  // Delay opacity so the drag ghost image is visible
  requestAnimationFrame(() => {
    target.style.opacity = '0.4'
  })
}

function handleDragEnd(e: React.DragEvent) {
  const target = e.currentTarget as HTMLElement
  target.classList.remove(css.dragging)
  target.style.opacity = ''
}

/* ── Session Card ── */

interface SessionCardProps {
  session: SessionSummary
  columnStatus: 'active' | 'review' | 'done'
}

export function SessionCard({ session, columnStatus }: SessionCardProps) {
  const openPanel = useUiStore((s) => s.openPanel)

  const isActive = columnStatus === 'active'
  const isReview = columnStatus === 'review'
  const isHistorical = session.status === 'historical'

  const cardClasses = [
    css.card,
    isActive ? css.activeCard : '',
    isReview ? css.reviewCard : '',
    isHistorical ? css.historical : '',
  ].filter(Boolean).join(' ')

  const metaTime = isHistorical && session.endedAt
    ? relativeTime(session.endedAt)
    : `session-${session.id.slice(0, 6)}`

  function handleClick() {
    openPanel(session.id)
  }

  return (
    <div
      className={cardClasses}
      draggable
      onDragStart={(e) => handleDragStart(e, session.id)}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      {isReview && <span className={css.reviewBadge}>needs review</span>}
      <div className={css.cardTop}>
        <div className={`${css.statusDot} ${statusDotClass(session.status)}`} />
        <div className={css.cardTitle}>{session.name}</div>
      </div>
      <div className={css.cardPreview}>
        <span className={css.promptChar}>&gt; </span>
        {session.cwd}
      </div>
      <div className={css.cardMeta}>
        <span className={css.cardTag}>{session.status}</span>
        <span>{metaTime}</span>
      </div>
    </div>
  )
}

/* ── Backlog Card ── */

interface BacklogCardProps {
  task: BacklogTask
}

export function BacklogCard({ task }: BacklogCardProps) {
  const openStartSession = useUiStore((s) => s.openStartSession)
  const renameTask = useBoardStore((s) => s.renameTask)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.name)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClick() {
    if (editing) return
    openStartSession(task.id, task.templateId ?? null)
  }

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditValue(task.name)
    setEditing(true)
    // Focus after render
    requestAnimationFrame(() => inputRef.current?.select())
  }, [task.name])

  function saveEdit() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== task.name) {
      renameTask(task.id, trimmed)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur()
    }
    if (e.key === 'Escape') {
      setEditValue(task.name)
      setEditing(false)
    }
  }

  const dragId = `backlog-${task.id}`

  return (
    <div
      className={css.card}
      draggable
      onDragStart={(e) => handleDragStart(e, dragId)}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      <div className={css.cardTop}>
        <div className={`${css.statusDot} ${css.statusIdle}`} />
        {editing ? (
          <input
            ref={inputRef}
            className={css.cardTitleInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <div className={css.cardTitle} onDoubleClick={handleDoubleClick}>
            {task.name}
          </div>
        )}
      </div>
      <div className={css.cardMeta}>
        {task.tag && <span className={css.cardTag}>{task.tag}</span>}
        {task.templateId && <span>{task.templateId}</span>}
      </div>
    </div>
  )
}
