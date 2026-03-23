import { useState, useEffect, useCallback } from 'react'
import { useUiStore } from '@/stores/ui.ts'
import { useBoardStore } from '@/stores/board.ts'
import { useTemplates } from '@/hooks/useTemplates.ts'
import { useCreateSession } from '@/hooks/useSessions.ts'
import * as filesApi from '@/api/files.ts'
import { PathAutocomplete } from '@/shared/components/PathAutocomplete.tsx'
import css from './StartSessionModal.module.css'

export function StartSessionModal() {
  const activeModal = useUiStore((s) => s.activeModal)
  const closeModal = useUiStore((s) => s.closeModal)
  const openPanel = useUiStore((s) => s.openPanel)
  const startSessionCardId = useUiStore((s) => s.startSessionCardId)
  const pendingTemplateId = useUiStore((s) => s.pendingTemplateId)

  const removeTask = useBoardStore((s) => s.removeTask)
  const backlogTasks = useBoardStore((s) => s.backlogTasks)

  const { data: templates = [] } = useTemplates()
  const createSession = useCreateSession()

  const [path, setPath] = useState('')

  const isOpen = activeModal === 'startSession'

  /* Resolve task and template info */
  const task = startSessionCardId != null
    ? backlogTasks.find((t) => t.id === startSessionCardId)
    : null

  const templateId = pendingTemplateId ?? task?.templateId ?? null
  const template = templateId
    ? templates.find((t) => t.id === templateId)
    : null

  const taskName = task?.name ?? template?.name ?? 'Session'

  /* Pre-fill path from template defaultCwd on open (render-time state adjustment) */
  const [prevOpen, setPrevOpen] = useState(false)
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen)
    if (isOpen) {
      setPath(template?.defaultCwd ?? '')
    }
  }

  /* Escape key closes modal */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeModal()
      }
    },
    [isOpen, closeModal],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  /* Browse for directory */
  const handleBrowse = useCallback(async () => {
    const result = await filesApi.browse()
    if (result.path) {
      setPath(result.path)
    }
  }, [])

  /* Start session */
  const handleStart = useCallback(
    async (cwd: string) => {
      const session = await createSession.mutateAsync({
        name: taskName,
        cwd: cwd || '~/',
        templateId: templateId ?? undefined,
        projectId: task?.projectId,
      })

      /* Remove from backlog if it came from a card */
      if (startSessionCardId != null) {
        removeTask(startSessionCardId)
      }

      closeModal()
      openPanel(session.id)
    },
    [taskName, templateId, task?.projectId, startSessionCardId, createSession, removeTask, closeModal, openPanel],
  )

  const handleSubmit = useCallback(() => {
    handleStart(path)
  }, [handleStart, path])

  const handleSkip = useCallback(() => {
    handleStart('~/')
  }, [handleStart])

  return (
    <div
      className={`${css.overlay} ${isOpen ? css.overlayOpen : ''}`}
      onClick={closeModal}
    >
      <div className={css.modal} onClick={(e) => e.stopPropagation()}>
        <div className={css.title}>start session</div>
        <div className={css.subtitle}>
          Open terminal for: {taskName}
        </div>

        <label className={css.label} htmlFor="sessionPath">
          directory
        </label>
        <div className={css.dirRow}>
          <PathAutocomplete
            value={path}
            onChange={setPath}
            placeholder="~/Projects/my-app"
            onSubmit={handleSubmit}
            className={css.pathWrapper}
          />
          <button className={css.browseBtn} onClick={handleBrowse}>
            Browse
          </button>
        </div>

        <div className={css.actions}>
          <button className={css.btnCancel} onClick={closeModal}>
            Cancel
          </button>
          <button className={css.btnSkip} onClick={handleSkip}>
            Skip
          </button>
          <button className={css.btnCreate} onClick={handleSubmit}>
            Start
          </button>
        </div>
      </div>
    </div>
  )
}
