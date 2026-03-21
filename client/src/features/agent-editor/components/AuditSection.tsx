import { useAgentAudit } from '@/hooks/useAgentConfig.ts'
import css from './AgentEditor.module.css'

interface AuditSectionProps {
  sessionId: string
}

const BADGE_MAP: Record<string, string> = {
  session_start: css.badgeSessionStart,
  file_write: css.badgeFileWrite,
  skill_install: css.badgeSkillInstall,
}

function auditBadgeClass(event: string): string {
  return BADGE_MAP[event] ?? css.badgeAudit
}

function formatDetail(detail: Record<string, unknown> | undefined): string {
  if (!detail) return ''
  return Object.entries(detail)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')
}

export function AuditSection({ sessionId }: AuditSectionProps) {
  const { data: entries, isLoading, isError } = useAgentAudit(sessionId)

  return (
    <>
      <div className={css.sectionTitle}>Audit</div>
      <div className={css.sectionDesc}>Action trail (audit.jsonl)</div>

      {isLoading && <div className={css.empty}>Loading...</div>}

      {isError && <div className={css.empty}>Failed to load audit log.</div>}

      {!isLoading && !isError && (!entries || entries.length === 0) && (
        <div className={css.empty}>No audit entries yet.</div>
      )}

      {entries?.map((e, i) => (
        <div key={i} className={css.entry}>
          <span
            className={`${css.badge} ${css.badgeAudit} ${auditBadgeClass(e.event ?? '')}`}
          >
            {e.event || 'unknown'}
          </span>
          <span className={css.entryContent}>{formatDetail(e.detail)}</span>
          <span className={css.entryTs}>
            {e.ts ? new Date(e.ts).toLocaleString() : ''}
          </span>
        </div>
      ))}
    </>
  )
}
