import { useCallback } from 'react'
import type { Template } from '@/types/index.ts'
import type { ConnectorCatalog } from '@/types/index.ts'
import { useUiStore } from '@/stores/ui.ts'
import { useDeleteTemplate } from '@/hooks/useTemplates.ts'
import css from './AgentTemplateCard.module.css'

interface AgentTemplateCardProps {
  template: Template
  catalog: ConnectorCatalog | undefined
}

export function AgentTemplateCard({ template, catalog }: AgentTemplateCardProps) {
  const setEditingTemplateId = useUiStore((s) => s.setEditingTemplateId)
  const openModal = useUiStore((s) => s.openModal)
  const openStartSession = useUiStore((s) => s.openStartSession)
  const deleteMutation = useDeleteTemplate()

  const purposePreview = (template.identity || template.purpose || '')
    .replace(/[#*_`]/g, '')
    .slice(0, 200)

  const connectorTags = (template.connectors || []).map((c) => {
    const cat = catalog?.[c.connectorId]
    return cat ? cat.name : c.connectorId
  })

  const allTags = [
    ...(template.skills || []).map((s) =>
      `skill:${typeof s === 'string' ? s : s.name}`,
    ),
    ...connectorTags,
    ...(template.connectors?.length ? [] : template.tools || []),
  ]

  const handleEdit = useCallback(() => {
    setEditingTemplateId(template.id)
    openModal('template')
  }, [template.id, setEditingTemplateId, openModal])

  const handleLaunch = useCallback(() => {
    openStartSession(null, template.id)
  }, [template.id, openStartSession])

  const handleDelete = useCallback(() => {
    if (!confirm(`Delete template "${template.name}"?`)) return
    deleteMutation.mutateAsync(template.id)
  }, [template.id, template.name, deleteMutation])

  return (
    <div className={css.card}>
      <div className={css.name}>{template.name}</div>
      <div className={css.cwd}>{template.defaultCwd || 'No default directory'}</div>
      <div className={css.purpose}>{purposePreview || 'No purpose defined'}</div>
      {allTags.length > 0 && (
        <div className={css.tags}>
          {allTags.map((tag) => (
            <span key={tag} className={css.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className={css.actions}>
        <button className={css.launch} onClick={handleLaunch}>
          Launch
        </button>
        <button onClick={handleEdit}>Edit</button>
        <button className={css.delete} onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}
