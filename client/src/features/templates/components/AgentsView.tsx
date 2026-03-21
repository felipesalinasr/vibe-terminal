import { useCallback } from 'react'
import { useTemplates } from '@/hooks/useTemplates.ts'
import { useConnectorCatalog } from '@/hooks/useConnectorCatalog.ts'
import { useUiStore } from '@/stores/ui.ts'
import { AgentTemplateCard } from './AgentTemplateCard.tsx'
import css from './AgentsView.module.css'

export function AgentsView() {
  const { data: templates = [] } = useTemplates()
  const { data: catalog } = useConnectorCatalog()
  const setEditingTemplateId = useUiStore((s) => s.setEditingTemplateId)
  const openModal = useUiStore((s) => s.openModal)

  const handleNewAgent = useCallback(() => {
    setEditingTemplateId(null)
    openModal('template')
  }, [setEditingTemplateId, openModal])

  return (
    <div className={css.view}>
      <div className={css.grid}>
        <div className={css.addCard} onClick={handleNewAgent}>
          <div className={css.addIcon}>+</div>
          <div className={css.addLabel}>New Agent</div>
        </div>
        {templates.map((t) => (
          <AgentTemplateCard key={t.id} template={t} catalog={catalog} />
        ))}
      </div>
    </div>
  )
}
