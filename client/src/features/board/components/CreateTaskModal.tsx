import { useState, useEffect, useCallback } from 'react'
import { useUiStore } from '@/stores/ui.ts'
import { useBoardStore } from '@/stores/board.ts'
import { useTemplates } from '@/hooks/useTemplates.ts'
import css from './CreateTaskModal.module.css'

export function CreateTaskModal() {
  const activeModal = useUiStore((s) => s.activeModal)
  const closeModal = useUiStore((s) => s.closeModal)
  const addTask = useBoardStore((s) => s.addTask)

  const { data: templates = [] } = useTemplates()

  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  const isOpen = activeModal === 'createTask'

  /* Reset form when opening (render-time state adjustment) */
  const [prevOpen, setPrevOpen] = useState(false)
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen)
    if (isOpen) {
      setSelectedTemplateId('')
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

  /* Create task */
  const handleCreate = useCallback(() => {
    if (!selectedTemplateId) return

    const template = templates.find((t) => t.id === selectedTemplateId)
    if (!template) return

    addTask({
      name: template.name,
      tag: 'agent',
      templateId: template.id,
    })

    closeModal()
  }, [selectedTemplateId, templates, addTask, closeModal])

  return (
    <div
      className={`${css.overlay} ${isOpen ? css.overlayOpen : ''}`}
      onClick={closeModal}
    >
      <div className={css.modal} onClick={(e) => e.stopPropagation()}>
        <div className={css.title}>new task</div>
        <div className={css.subtitle}>Choose an agent to run</div>

        <label className={css.label} htmlFor="taskTemplateSelect">
          agent
        </label>
        <select
          id="taskTemplateSelect"
          className={css.select}
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
        >
          <option value="">-- select agent --</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <div className={css.actions}>
          <button className={css.btnCancel} onClick={closeModal}>
            Cancel
          </button>
          <button
            className={css.btnCreate}
            onClick={handleCreate}
            disabled={!selectedTemplateId}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
