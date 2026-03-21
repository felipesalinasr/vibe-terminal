import { useState, useMemo, useCallback, useRef } from 'react'
import { useConnectorCatalog } from '@/hooks/useConnectorCatalog.ts'
import type { ConnectorEntry } from '@/types/index.ts'
import { ToolCard } from './ToolCard.tsx'
import { ToolDetailPanel } from './ToolDetailPanel.tsx'
import css from './ToolsView.module.css'

const CATEGORY_ORDER = ['sales', 'communication', 'productivity', 'marketing', 'dev-tools']

function sortCategories(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

export function ToolsView() {
  const { data: catalog } = useConnectorCatalog()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const categories = useMemo(() => {
    if (!catalog) return []
    const q = search.toLowerCase()
    const cats: Record<string, ConnectorEntry[]> = {}
    for (const conn of Object.values(catalog)) {
      const nameMatch = conn.name.toLowerCase().includes(q)
      const descMatch = (conn.description || '').toLowerCase().includes(q)
      if (q && !nameMatch && !descMatch) continue
      const cat = conn.category || 'other'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(conn)
    }
    return sortCategories(Object.keys(cats)).map((cat) => ({
      name: cat,
      items: cats[cat],
    }))
  }, [catalog, search])

  const selectedConnector = selectedId && catalog ? catalog[selectedId] : null

  const handleCardClick = useCallback(
    (connectorId: string) => {
      if (selectedId === connectorId) {
        setSelectedId(null)
      } else {
        setSelectedId(connectorId)
        setTimeout(() => {
          panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 0)
      }
    },
    [selectedId],
  )

  return (
    <div className={css.view}>
      <div className={css.searchBar}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools..."
        />
      </div>

      <div className={css.grid}>
        {categories.length === 0 && (
          <div className={css.empty}>No tools found</div>
        )}
        {categories.map((cat) => (
          <div key={cat.name}>
            <div className={css.categoryLabel}>{cat.name}</div>
            {cat.items.map((conn) => (
              <div key={conn.id}>
                <ToolCard
                  connector={conn}
                  selected={selectedId === conn.id}
                  onClick={() => handleCardClick(conn.id)}
                />
                {selectedId === conn.id && selectedConnector && (
                  <div ref={panelRef}>
                    <ToolDetailPanel connector={selectedConnector} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
