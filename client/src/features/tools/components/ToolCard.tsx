import type { ConnectorEntry } from '@/types/index.ts'
import css from './ToolCard.module.css'

interface ToolCardProps {
  connector: ConnectorEntry
  selected: boolean
  onClick: () => void
}

export function ToolCard({ connector, selected, onClick }: ToolCardProps) {
  const actionCount = connector.actions.length
  const actionLabel = actionCount === 1 ? '1 action' : `${actionCount} actions`

  return (
    <div
      className={`${css.card} ${selected ? css.expanded : ''}`}
      onClick={onClick}
    >
      <span className={css.icon}>{connector.icon}</span>
      <span className={css.name}>{connector.name}</span>
      <span className={css.desc}>{connector.description || ''}</span>
      <span className={css.badge}>{actionLabel}</span>
      <span className={css.chevron}>&#x25B8;</span>
    </div>
  )
}
