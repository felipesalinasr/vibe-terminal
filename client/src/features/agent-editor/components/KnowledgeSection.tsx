import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAgentKnowledge, agentKeys } from '@/hooks/useAgentConfig.ts'
import * as agentsApi from '@/api/agents.ts'
import * as filesApi from '@/api/files.ts'
import css from './AgentEditor.module.css'

interface KnowledgeSectionProps {
  sessionId: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

export function KnowledgeSection({ sessionId }: KnowledgeSectionProps) {
  const { data: files, isLoading } = useAgentKnowledge(sessionId)
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const upload = useCallback(
    async (file: File) => {
      await agentsApi.uploadKnowledge(sessionId, file)
      qc.invalidateQueries({ queryKey: agentKeys.knowledge(sessionId) })
    },
    [sessionId, qc],
  )

  const handleDelete = useCallback(
    async (filename: string) => {
      await agentsApi.deleteKnowledge(sessionId, filename)
      qc.invalidateQueries({ queryKey: agentKeys.knowledge(sessionId) })
    },
    [sessionId, qc],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
      for (const file of droppedFiles) {
        await upload(file)
      }
    },
    [upload],
  )

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? [])
      for (const file of selected) {
        await upload(file)
      }
      // Reset so the same file can be uploaded again
      e.target.value = ''
    },
    [upload],
  )

  const handleOpen = useCallback((path: string) => {
    filesApi.openFile(path, 'file')
  }, [])

  return (
    <>
      <div className={css.sectionTitle}>Knowledge Base</div>
      <div className={css.sectionDesc}>
        Upload reference files for this agent.
      </div>

      {isLoading && <div className={css.loading}>Loading...</div>}

      {!isLoading && (!files || files.length === 0) && (
        <div className={css.loading}>No knowledge files uploaded</div>
      )}

      {files?.map((f) => (
        <div key={f.name} className={css.fileItem}>
          <span className={css.fileName}>{f.name}</span>
          <span className={css.fileDesc}>{formatBytes(f.size)}</span>
          <div className={css.fileActions}>
            <button className={css.btn} onClick={() => handleOpen(f.path)}>
              Open
            </button>
            <button
              className={`${css.btn} ${css.btnDanger}`}
              onClick={() => handleDelete(f.name)}
            >
              &times;
            </button>
          </div>
        </div>
      ))}

      <div
        className={`${css.uploadZone} ${dragOver ? css.uploadZoneDragOver : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        Drop files here or{' '}
        <label className={css.uploadLabel}>
          <input
            ref={fileInputRef}
            type="file"
            className={css.uploadInput}
            multiple
            onChange={handleFileChange}
          />
          click to upload
        </label>
      </div>
    </>
  )
}
