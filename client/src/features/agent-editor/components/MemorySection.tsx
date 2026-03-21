import { useAgentMemory } from '@/hooks/useAgentConfig.ts'
import css from './AgentEditor.module.css'

interface MemorySectionProps {
  sessionId: string
}

const BADGE_MAP: Record<string, string> = {
  convention: css.badgeConvention,
  correction: css.badgeCorrection,
  decision: css.badgeDecision,
  preference: css.badgePreference,
}

function memoryBadgeClass(type: string): string {
  return BADGE_MAP[type] ?? css.badgeMemory
}

export function MemorySection({ sessionId }: MemorySectionProps) {
  const { data: entries, isLoading, isError } = useAgentMemory(sessionId)

  return (
    <>
      <div className={css.sectionTitle}>Memory</div>
      <div className={css.sectionDesc}>
        Persistent structured memory (memory.jsonl)
      </div>

      {isLoading && <div className={css.empty}>Loading...</div>}

      {isError && <div className={css.empty}>Failed to load memory.</div>}

      {!isLoading && !isError && (!entries || entries.length === 0) && (
        <div className={css.empty}>
          No memory entries yet. The agent will log conventions, corrections, and
          decisions here.
        </div>
      )}

      {entries?.map((e, i) => (
        <div key={i} className={css.entry}>
          <span className={`${css.badge} ${memoryBadgeClass(e.type ?? '')}`}>
            {e.type || 'note'}
          </span>
          <span className={css.entryContent}>{e.content || ''}</span>
          <span className={css.entryTs}>
            {e.ts ? new Date(e.ts).toLocaleString() : ''}
          </span>
        </div>
      ))}
    </>
  )
}
