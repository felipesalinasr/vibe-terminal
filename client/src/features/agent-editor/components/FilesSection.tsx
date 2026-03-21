import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAgentConfig, agentKeys } from '@/hooks/useAgentConfig.ts'
import * as agentsApi from '@/api/agents.ts'
import * as filesApi from '@/api/files.ts'
import css from './AgentEditor.module.css'

interface FilesSectionProps {
  sessionId: string
}

export function FilesSection({ sessionId }: FilesSectionProps) {
  const { data } = useAgentConfig(sessionId)
  const qc = useQueryClient()
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const files = data?.config.files ?? []

  const handleOpen = useCallback((path: string, action: 'file' | 'folder') => {
    filesApi.openFile(path, action)
  }, [])

  const handleRemove = useCallback(
    async (path: string) => {
      await agentsApi.removeFile(sessionId, path)
      qc.invalidateQueries({ queryKey: agentKeys.config(sessionId) })
    },
    [sessionId, qc],
  )

  const handleAdd = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      await agentsApi.addFile(sessionId, trimmed)
      qc.invalidateQueries({ queryKey: agentKeys.config(sessionId) })
      setShowInput(false)
    },
    [sessionId, qc],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleAdd(e.currentTarget.value)
      }
      if (e.key === 'Escape') {
        setShowInput(false)
      }
    },
    [handleAdd],
  )

  const handleShowInput = useCallback(() => {
    setShowInput(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  return (
    <>
      <div className={css.sectionTitle}>Files</div>
      <div className={css.sectionDesc}>
        Files produced by this agent. Auto-detected from terminal + manually
        added.
      </div>

      <div>
        {files.length === 0 && (
          <div className={css.loading}>No files tracked yet</div>
        )}

        {files.map((f) => {
          const name = f.split('/').pop() ?? f
          return (
            <div key={f} className={css.fileItem}>
              <span className={css.fileName} title={f}>
                {name}
              </span>
              <div className={css.fileActions}>
                <button
                  className={css.btn}
                  onClick={() => handleOpen(f, 'file')}
                >
                  Open
                </button>
                <button
                  className={css.btn}
                  onClick={() => handleOpen(f, 'folder')}
                >
                  Finder
                </button>
                <button
                  className={`${css.btn} ${css.btnDanger}`}
                  onClick={() => handleRemove(f)}
                >
                  &times;
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        {showInput ? (
          <input
            ref={inputRef}
            className={`${css.tagInput} ${css.tagInputWide}`}
            placeholder="/absolute/path/to/file..."
            onKeyDown={handleKeyDown}
            onBlur={() => setShowInput(false)}
          />
        ) : (
          <button className={css.tagAdd} onClick={handleShowInput}>
            + Add file path
          </button>
        )}
      </div>
    </>
  )
}
