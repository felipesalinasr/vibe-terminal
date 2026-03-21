import { useState, useRef, useCallback } from 'react'
import { useAgentConfig, useUpdateAgent } from '@/hooks/useAgentConfig.ts'
import css from './AgentEditor.module.css'

interface ToolsSectionProps {
  sessionId: string
}

export function ToolsSection({ sessionId }: ToolsSectionProps) {
  const { data } = useAgentConfig(sessionId)
  const updateAgent = useUpdateAgent()
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const tools = data?.config.tools ?? []

  const handleAdd = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed || tools.includes(trimmed)) return
      const next = [...tools, trimmed]
      updateAgent.mutate({ sessionId, updates: { tools: next } })
      setShowInput(false)
    },
    [sessionId, tools, updateAgent],
  )

  const handleRemove = useCallback(
    (value: string) => {
      const next = tools.filter((t) => t !== value)
      updateAgent.mutate({ sessionId, updates: { tools: next } })
    },
    [sessionId, tools, updateAgent],
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

  const handleBlur = useCallback(() => {
    setShowInput(false)
  }, [])

  const handleShowInput = useCallback(() => {
    setShowInput(true)
    // Focus after render
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  return (
    <>
      <div className={css.sectionTitle}>Tools</div>
      <div className={css.sectionDesc}>Click + to add, x to remove.</div>

      <div className={css.tags}>
        {tools.map((tool) => (
          <span key={tool} className={css.tag}>
            {tool}
            <button
              className={css.tagRemove}
              onClick={() => handleRemove(tool)}
            >
              &times;
            </button>
          </span>
        ))}

        {showInput ? (
          <input
            ref={inputRef}
            className={css.tagInput}
            placeholder="Add tool..."
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        ) : (
          <button className={css.tagAdd} onClick={handleShowInput}>
            + Add
          </button>
        )}
      </div>
    </>
  )
}
