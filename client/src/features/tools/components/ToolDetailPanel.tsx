import type { ConnectorEntry } from '@/types/index.ts'
import css from './ToolDetailPanel.module.css'

interface ToolDetailPanelProps {
  connector: ConnectorEntry
}

export function ToolDetailPanel({ connector }: ToolDetailPanelProps) {
  return (
    <div className={css.panel}>
      <div className={css.header}>
        <span className={css.icon}>{connector.icon}</span>
        <span className={css.name}>{connector.name}</span>
        <span className={css.desc}>{connector.description || ''}</span>
      </div>
      {connector.actions.map((action) => (
        <div key={action.id} className={css.actionRow}>
          <span className={css.actionName}>{action.name}</span>
          <span className={css.actionMcp} title={action.mcpTool}>
            {action.mcpTool}
          </span>
        </div>
      ))}
    </div>
  )
}
