import { useState, useRef, useEffect, useCallback } from 'react'
import { useAgentConstraints, useUpdateConstraints } from '@/hooks/useAgentConfig.ts'
import css from './AgentEditor.module.css'

interface ConstraintsSectionProps {
  sessionId: string
}

export function ConstraintsSection({ sessionId }: ConstraintsSectionProps) {
  const { data } = useAgentConstraints(sessionId)
  const updateConstraints = useUpdateConstraints()

  const [value, setValue] = useState('')
  const [showSaved, setShowSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)

  // Sync from server on first load
  useEffect(() => {
    if (data && !initializedRef.current) {
      setValue(data.content ?? '')
      initializedRef.current = true
    }
  }, [data])

  // Reset when sessionId changes
  useEffect(() => {
    initializedRef.current = false
  }, [sessionId])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setValue(newValue)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        updateConstraints.mutate(
          { sessionId, content: newValue },
          {
            onSuccess: () => {
              setShowSaved(true)
              if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
              savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500)
            },
          },
        )
      }, 800)
    },
    [sessionId, updateConstraints],
  )

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  return (
    <>
      <div className={css.sectionTitle}>Constraints</div>
      <div className={css.sectionDesc}>
        AGENTS.md &mdash; operational rules, workflows, guardrails. Saved
        automatically.
      </div>
      <textarea
        className={css.textarea}
        value={value}
        onChange={handleChange}
        placeholder="Define operational constraints, messaging rules, execution workflows..."
      />
      <div
        className={`${css.saveIndicator} ${showSaved ? css.saveIndicatorVisible : ''}`}
      >
        Saved
      </div>
    </>
  )
}
