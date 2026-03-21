import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateSession, useSessions, sessionKeys } from '@/hooks/useSessions.ts'
import { useUiStore } from '@/stores/ui.ts'
import styles from './HistoricalBar.module.css'

interface HistoricalBarProps {
  sessionId: string
}

export function HistoricalBar({ sessionId }: HistoricalBarProps) {
  const queryClient = useQueryClient()
  const { data: sessions } = useSessions()
  const createSession = useCreateSession()
  const openPanel = useUiStore((s) => s.openPanel)
  const closePanel = useUiStore((s) => s.closePanel)

  const session = sessions?.find((s) => s.id === sessionId)
  const endedText = session?.endedAt
    ? `Session ended ${formatRelativeTime(session.endedAt)}`
    : 'Session ended'

  const handleRestart = useCallback(async () => {
    if (!session) return

    try {
      const newSession = await createSession.mutateAsync({
        name: session.name,
        cwd: session.cwd,
      })
      closePanel()
      await queryClient.invalidateQueries({ queryKey: sessionKeys.all })
      openPanel(newSession.id)
    } catch {
      // Restart failed silently
    }
  }, [session, createSession, closePanel, queryClient, openPanel])

  return (
    <div className={styles.bar}>
      <span className={styles.text}>{endedText}</span>
      <button className={styles.restartBtn} onClick={handleRestart}>
        Restart
      </button>
    </div>
  )
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
