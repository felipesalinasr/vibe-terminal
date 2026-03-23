import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@/stores/ui.ts'
import { useProjects, useUpdateProject } from '@/hooks/useProjects.ts'
import css from './ProjectContextEditor.module.css'

export function ProjectContextEditor() {
  const projectId = useUiStore((s) => s.contextEditorProjectId)
  const close = useUiStore((s) => s.closeContextEditor)
  const { data: projects = [] } = useProjects()
  const updateProject = useUpdateProject()

  const project = projects.find((p) => p.id === projectId)

  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync draft when project changes
  const [prevProjectId, setPrevProjectId] = useState(projectId)
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId)
    setDraft(project?.context ?? '')
    setSaved(false)
  }

  // Auto-save on draft change (debounced)
  const mutate = updateProject.mutate
  useEffect(() => {
    if (!projectId) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      mutate({ id: projectId, input: { context: draft } })
      setSaved(true)
      // Clear "saved" indicator after 2s
      setTimeout(() => setSaved(false), 2000)
    }, 500)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [draft, projectId, mutate])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    if (projectId) {
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }
  }, [projectId, close])

  if (!projectId || !project) return null

  return (
    <>
      <div className={css.overlay} onClick={close} />
      <div className={css.panel}>
        <div className={css.header}>
          <div className={css.headerLeft}>
            <span className={css.title}>{project.name}</span>
            <span className={css.subtitle}>shared context</span>
          </div>
          <button className={css.closeBtn} onClick={close}>
            ESC
          </button>
        </div>

        <div className={css.body}>
          <span className={css.label}>
            Project context &mdash; visible to all agents in this project
          </span>
          <textarea
            className={css.textarea}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setSaved(false) }}
            placeholder="Add shared rules, architecture decisions, style guides, domain knowledge..."
          />
        </div>

        <div className={css.footer}>
          <span>{draft.length} chars</span>
          {saved && <span className={css.saved}>Saved</span>}
        </div>
      </div>
    </>
  )
}
