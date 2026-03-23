import { useState, useEffect, useCallback } from 'react'
import { useUiStore } from '@/stores/ui.ts'
import { useCreateProject, useSetupProject, useGitHubStatus } from '@/hooks/useProjects.ts'
import * as filesApi from '@/api/files.ts'
import { PathAutocomplete } from '@/shared/components/PathAutocomplete.tsx'
import css from './CreateProjectModal.module.css'

type Status = 'idle' | 'creating' | 'setting-up' | 'done' | 'error'

export function CreateProjectModal() {
  const activeModal = useUiStore((s) => s.activeModal)
  const closeModal = useUiStore((s) => s.closeModal)

  const createProject = useCreateProject()
  const setupProject = useSetupProject()
  const { data: ghStatus } = useGitHubStatus()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [path, setPath] = useState('')
  const [createRepo, setCreateRepo] = useState(false)
  const [repoPrivate, setRepoPrivate] = useState(true)

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [resultFiles, setResultFiles] = useState<string[]>([])
  const [resultRepoUrl, setResultRepoUrl] = useState('')
  const [createdProjectId, setCreatedProjectId] = useState('')

  const isOpen = activeModal === 'createProject'

  /* Reset form when opening (render-time state adjustment) */
  const [prevOpen, setPrevOpen] = useState(false)
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen)
    if (isOpen) {
      setName('')
      setDescription('')
      setPath('')
      setCreateRepo(false)
      setRepoPrivate(true)
      setStatus('idle')
      setError('')
      setResultFiles([])
      setResultRepoUrl('')
      setCreatedProjectId('')
    }
  }

  /* Escape key closes modal */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        closeModal()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeModal])

  /* Auto-close after done */
  useEffect(() => {
    if (status !== 'done') return
    const timer = setTimeout(() => closeModal(), 2000)
    return () => clearTimeout(timer)
  }, [status, closeModal])

  /* Browse for directory */
  const handleBrowse = useCallback(async () => {
    const result = await filesApi.browse()
    if (result.path) {
      setPath(result.path)
    }
  }, [])

  /* Extract stable mutateAsync references */
  const createMutateAsync = createProject.mutateAsync
  const setupMutateAsync = setupProject.mutateAsync

  /* Submit: create project then run setup */
  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !path.trim()) return

    setError('')
    setStatus('creating')

    try {
      const project = await createMutateAsync({
        name: name.trim(),
        description: description.trim(),
        path: path.trim(),
      })
      setCreatedProjectId(project.id)

      setStatus('setting-up')
      const result = await setupMutateAsync({
        id: project.id,
        input: { createRepo, repoPrivate },
      })

      setResultFiles(result.filesWritten)
      setResultRepoUrl(result.repoUrl ?? '')
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }, [name, description, path, createRepo, repoPrivate, createMutateAsync, setupMutateAsync])

  /* Retry setup only (project already created) */
  const handleRetrySetup = useCallback(async () => {
    if (!createdProjectId) return

    setError('')
    setStatus('setting-up')

    try {
      const result = await setupMutateAsync({
        id: createdProjectId,
        input: { createRepo, repoPrivate },
      })

      setResultFiles(result.filesWritten)
      setResultRepoUrl(result.repoUrl ?? '')
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }, [createdProjectId, createRepo, repoPrivate, setupMutateAsync])

  const ghAvailable = ghStatus?.available ?? false
  const canSubmit = name.trim().length > 0 && path.trim().length > 0 && status === 'idle'
  const isProcessing = status === 'creating' || status === 'setting-up'

  return (
    <div
      className={`${css.overlay} ${isOpen ? css.overlayOpen : ''}`}
      onClick={closeModal}
    >
      <div className={css.modal} onClick={(e) => e.stopPropagation()}>
        <div className={css.title}>new project</div>
        <div className={css.subtitle}>Set up a project with multi-agent workflow</div>

        {/* Form — hidden during processing/done */}
        {status === 'idle' && (
          <>
            <label className={css.label} htmlFor="projectName">
              name
            </label>
            <input
              id="projectName"
              className={css.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              autoFocus
            />

            <label className={css.label} htmlFor="projectDesc">
              description
            </label>
            <input
              id="projectDesc"
              className={css.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional one-line description"
            />

            <label className={css.label}>
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

            <div className={css.checkRow}>
              <input
                type="checkbox"
                id="createRepo"
                checked={createRepo}
                onChange={(e) => setCreateRepo(e.target.checked)}
                disabled={!ghAvailable}
              />
              <label
                className={`${css.checkLabel} ${!ghAvailable ? css.disabled : ''}`}
                htmlFor="createRepo"
              >
                Create GitHub repo
              </label>
              {!ghAvailable && (
                <span className={css.ghTooltip}>
                  (gh CLI not available)
                </span>
              )}
            </div>

            {createRepo && (
              <div className={css.radioRow}>
                <label className={css.radioLabel}>
                  <input
                    type="radio"
                    name="repoVisibility"
                    checked={repoPrivate}
                    onChange={() => setRepoPrivate(true)}
                  />
                  Private
                </label>
                <label className={css.radioLabel}>
                  <input
                    type="radio"
                    name="repoVisibility"
                    checked={!repoPrivate}
                    onChange={() => setRepoPrivate(false)}
                  />
                  Public
                </label>
              </div>
            )}
          </>
        )}

        {/* Status messages */}
        {status === 'creating' && (
          <div className={`${css.status} ${css.statusCreating}`}>
            Creating project...
          </div>
        )}

        {status === 'setting-up' && (
          <div className={`${css.status} ${css.statusSettingUp}`}>
            Scaffolding multi-agent workflow...
          </div>
        )}

        {status === 'done' && (
          <div className={`${css.status} ${css.statusDone}`}>
            Project created successfully!
            {resultFiles.length > 0 && (
              <ul className={css.statusFiles}>
                {resultFiles.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            {resultRepoUrl && (
              <div style={{ marginTop: 8 }}>
                Repo:{' '}
                <a
                  className={css.repoLink}
                  href={resultRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {resultRepoUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className={`${css.status} ${css.statusError}`}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className={css.actions}>
          {status === 'idle' && (
            <>
              <button className={css.btnCancel} onClick={closeModal}>
                Cancel
              </button>
              <button
                className={css.btnCreate}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                Create
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <button className={css.btnCancel} onClick={closeModal}>
                Close
              </button>
              {createdProjectId && (
                <button className={css.btnRetry} onClick={handleRetrySetup}>
                  Retry Setup
                </button>
              )}
            </>
          )}

          {status === 'done' && (
            <button className={css.btnCancel} onClick={closeModal}>
              Close
            </button>
          )}

          {isProcessing && (
            <button className={css.btnCancel} disabled>
              Working...
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
