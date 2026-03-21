import { useState, useEffect, useRef, useMemo } from 'react'
import { useUiStore } from '@/stores/ui.ts'
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
} from '@/hooks/useTemplates.ts'
import { useConnectorCatalog } from '@/hooks/useConnectorCatalog.ts'
import { PathAutocomplete } from '@/shared/components/PathAutocomplete.tsx'
import * as skillsApi from '@/api/skills.ts'
import * as filesApi from '@/api/files.ts'
import type {
  TemplateSkill,
  TemplateConnector,
  ConnectorEntry,
  AgentSkill,
  ExternalSkill,
} from '@/types/index.ts'
import css from './TemplateModal.module.css'

/* ── Skill entry normalized for local state ── */
interface SkillEntry {
  name: string
  source: string
  installCommand?: string
  repo?: string
  path?: string
  description?: string
}

type SkillTab = 'paste' | 'local' | 'browse'

const SKILL_CHIPS_LIMIT = 3
const CATEGORY_ORDER = ['sales', 'communication', 'productivity', 'marketing', 'dev-tools']

function normalizeSkills(skills: (string | TemplateSkill)[]): SkillEntry[] {
  if (!Array.isArray(skills)) return []
  return skills.map((s) =>
    typeof s === 'string' ? { name: s, source: 'local' } : { ...s, source: s.source ?? 'local' },
  )
}

function sortCategories(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

export function TemplateModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const editingTemplateId = useUiStore((s) => s.editingTemplateId)

  const { data: templates = [] } = useTemplates()
  const { data: catalog } = useConnectorCatalog()
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()

  const isEdit = editingTemplateId != null
  const editTemplate = isEdit
    ? templates.find((t) => t.id === editingTemplateId)
    : undefined

  /* ── Modal expand ── */
  const [expanded, setExpanded] = useState(false)

  /* ── Form state ── */
  const [name, setName] = useState('')
  const [cwd, setCwd] = useState('')
  const [identity, setIdentity] = useState('')
  const [constraints, setConstraints] = useState('')

  /* ── Skills state ── */
  const [skillEntries, setSkillEntries] = useState<SkillEntry[]>([])
  const [skillChipsExpanded, setSkillChipsExpanded] = useState(false)
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(-1)
  const [skillTab, setSkillTab] = useState<SkillTab>('paste')
  const [pasteInput, setPasteInput] = useState('')
  const [localSkills, setLocalSkills] = useState<AgentSkill[]>([])
  const [externalSkills, setExternalSkills] = useState<ExternalSkill[]>([])
  const [localLoaded, setLocalLoaded] = useState(false)
  const [externalLoaded, setExternalLoaded] = useState(false)
  const [localSearch, setLocalSearch] = useState('')
  const [externalSearch, setExternalSearch] = useState('')
  const [skillDetailContent, setSkillDetailContent] = useState('')
  const [skillDetailOriginal, setSkillDetailOriginal] = useState('')
  const [skillDetailLoading, setSkillDetailLoading] = useState(false)
  const [saveLabel, setSaveLabel] = useState('Save')

  /* ── Connectors state ── */
  const [connectorEntries, setConnectorEntries] = useState<TemplateConnector[]>([])
  const [selectedConnectorIndex, setSelectedConnectorIndex] = useState(-1)
  const [connectorSearch, setConnectorSearch] = useState('')

  /* ── Importing state ── */
  const [importing, setImporting] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)

  /* ── Migrate old tools array to connector entries ── */
  function migrateToolsToConnectors(
    tools: string[],
    cat: Record<string, ConnectorEntry> | undefined,
  ): TemplateConnector[] {
    if (!tools?.length || !cat) return []
    const entries: TemplateConnector[] = []
    for (const conn of Object.values(cat)) {
      const matched: string[] = []
      for (const action of conn.actions) {
        if (tools.includes(action.mcpTool) || tools.includes(action.id)) {
          matched.push(action.id)
        }
      }
      if (matched.length) {
        entries.push({
          connectorId: conn.id,
          enabledActions: matched,
          allEnabled: matched.length === conn.actions.length,
        })
      }
    }
    return entries
  }

  /* ── Init form from template (render-time state adjustment) ── */
  const [prevEditId, setPrevEditId] = useState<string | undefined>(undefined)
  const currentEditId = editingTemplateId ?? undefined
  if (currentEditId !== prevEditId) {
    setPrevEditId(currentEditId)
    if (isEdit && editTemplate) {
      setName(editTemplate.name || '')
      setCwd(editTemplate.defaultCwd || '')
      setIdentity(editTemplate.identity || editTemplate.purpose || '')
      setConstraints(editTemplate.constraints || '')
      setSkillEntries(normalizeSkills(editTemplate.skills || []))
      if (editTemplate.connectors?.length) {
        setConnectorEntries(JSON.parse(JSON.stringify(editTemplate.connectors)))
      } else {
        setConnectorEntries(migrateToolsToConnectors(editTemplate.tools || [], catalog))
      }
    } else {
      setName('')
      setCwd('')
      setIdentity('')
      setConstraints('')
      setSkillEntries([])
      setConnectorEntries([])
    }
    setExpanded(false)
    setSkillChipsExpanded(false)
    setSelectedSkillIndex(-1)
    setSelectedConnectorIndex(-1)
    setSkillTab('paste')
    setPasteInput('')
    setLocalSearch('')
    setExternalSearch('')
    setConnectorSearch('')
    setLocalLoaded(false)
    setExternalLoaded(false)
    setSaveLabel('Save')
  }

  // Focus name input after form init
  useEffect(() => {
    if (currentEditId !== undefined || currentEditId === undefined) {
      const timer = setTimeout(() => nameRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [currentEditId])

  /* ── Escape key ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeModal])

  /* ────────────────────────────────────────
   * SKILLS
   * ──────────────────────────────────────── */

  const addSkillEntry = (entry: SkillEntry) => {
    setSkillEntries((prev) => {
      if (prev.some((e) => e.name === entry.name)) return prev
      return [...prev, entry]
    })
  }

  const removeSkillChip = (index: number) => {
    if (selectedSkillIndex === index) setSelectedSkillIndex(-1)
    else if (selectedSkillIndex > index) setSelectedSkillIndex((p) => p - 1)
    setSkillEntries((prev) => prev.filter((_, i) => i !== index))
  }

  /* ── Skill detail panel ── */
  const openSkillDetail = async (index: number) => {
    if (selectedSkillIndex === index) {
      setSelectedSkillIndex(-1)
      return
    }
    setSelectedSkillIndex(index)
    const entry = skillEntries[index]
    if (!entry) return

    let detailPath = entry.path
    if (!detailPath && entry.source === 'local' && cwd) {
      detailPath = `${cwd.replace(/\/+$/, '')}/.claude/skills/${entry.name}/SKILL.md`
      setSkillEntries((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], path: detailPath }
        return next
      })
    }

    setSkillDetailLoading(true)
    setSkillDetailContent('')
    setSkillDetailOriginal('')

    if (detailPath) {
      try {
        const data = await skillsApi.readSkillContent(detailPath)
        setSkillDetailContent(data.content || '')
        setSkillDetailOriginal(data.content || '')
      } catch {
        setSkillDetailContent('')
        setSkillDetailOriginal('')
      }
    }
    setSkillDetailLoading(false)
  }

  const saveSkillDetail = async (index: number) => {
    const entry = skillEntries[index]
    if (!entry) return
    let savePath = entry.path
    if (!savePath && cwd) {
      savePath = `${cwd.replace(/\/+$/, '')}/.claude/skills/${entry.name}/SKILL.md`
      setSkillEntries((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], path: savePath, source: 'local' }
        return next
      })
    }
    if (!savePath) {
      setSaveLabel('No directory set')
      setTimeout(() => setSaveLabel('Save'), 1500)
      return
    }
    setSaveLabel('Saving...')
    try {
      await skillsApi.writeSkillContent(savePath, skillDetailContent)
      setSkillDetailOriginal(skillDetailContent)
      setSaveLabel('Saved')
      setTimeout(() => setSaveLabel('Save'), 1200)
    } catch {
      setSaveLabel('Error')
      setTimeout(() => setSaveLabel('Save'), 1500)
    }
  }

  /* ── Paste command ── */
  const parseAndAddSkillCommand = () => {
    const val = pasteInput.trim()
    if (!val) return
    const skillMatch = val.match(/--skill\s+(\S+)/)
    const repoMatch = val.match(/add\s+(\S+)/)
    if (skillMatch) {
      addSkillEntry({
        name: skillMatch[1],
        source: 'npx',
        installCommand: val,
        repo: repoMatch ? repoMatch[1] : undefined,
      })
    } else {
      addSkillEntry({ name: val, source: 'npx', installCommand: val })
    }
    setPasteInput('')
  }

  /* ── Local skills picker ── */
  const loadLocalSkills = async () => {
    if (localLoaded) return
    try {
      const data = await skillsApi.listLocalSkills()
      setLocalSkills(data)
    } catch {
      setLocalSkills([])
    }
    setLocalLoaded(true)
  }

  /* ── External skills picker ── */
  const loadExternalSkills = async () => {
    if (externalLoaded) return
    try {
      const data = await skillsApi.listExternalSkills()
      setExternalSkills(data)
    } catch {
      setExternalSkills([])
    }
    setExternalLoaded(true)
  }

  const switchTab = (tab: SkillTab) => {
    setSkillTab(tab)
    setLocalSearch('')
    setExternalSearch('')
    if (tab === 'local') loadLocalSkills()
    if (tab === 'browse') loadExternalSkills()
  }

  const filteredLocalSkills = useMemo(() => {
    const q = localSearch.toLowerCase()
    if (!q) return localSkills
    return localSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (s.sourceAgent || '').toLowerCase().includes(q),
    )
  }, [localSkills, localSearch])

  const filteredExternalSkills = useMemo(() => {
    const q = externalSearch.toLowerCase()
    if (!q) return externalSkills
    return externalSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.repo || '').toLowerCase().includes(q),
    )
  }, [externalSkills, externalSearch])

  const addedSkillNames = useMemo(
    () => new Set(skillEntries.map((e) => e.name)),
    [skillEntries],
  )

  /* ── Visible skill chips ── */
  const visibleSkills =
    !skillChipsExpanded && skillEntries.length > SKILL_CHIPS_LIMIT
      ? skillEntries.slice(0, SKILL_CHIPS_LIMIT)
      : skillEntries
  const hiddenCount = skillEntries.length - SKILL_CHIPS_LIMIT

  /* ────────────────────────────────────────
   * CONNECTORS
   * ──────────────────────────────────────── */

  const addConnector = (connectorId: string) => {
    setConnectorEntries((prev) => {
      if (prev.some((c) => c.connectorId === connectorId)) return prev
      const conn = catalog?.[connectorId]
      if (!conn) return prev
      const cfg: TemplateConnector = {
        connectorId,
        enabledActions: conn.actions.map((a) => a.id),
        allEnabled: true,
      }
      const next = [...prev, cfg]
      setSelectedConnectorIndex(next.length - 1)
      return next
    })
  }

  const removeConnector = (index: number) => {
    if (selectedConnectorIndex === index) setSelectedConnectorIndex(-1)
    else if (selectedConnectorIndex > index)
      setSelectedConnectorIndex((p) => p - 1)
    setConnectorEntries((prev) => prev.filter((_, i) => i !== index))
  }

  const toggleAction = (connIndex: number, actionId: string, enabled: boolean) => {
    setConnectorEntries((prev) => {
      const next = prev.map((cfg, i) => {
        if (i !== connIndex) return cfg
        const conn = catalog?.[cfg.connectorId]
        if (!conn) return cfg
        let ea = cfg.allEnabled
          ? conn.actions.map((a) => a.id)
          : [...(cfg.enabledActions || [])]
        if (enabled) {
          if (!ea.includes(actionId)) ea = [...ea, actionId]
        } else {
          ea = ea.filter((id) => id !== actionId)
        }
        const allOn = ea.length === conn.actions.length
        return { ...cfg, enabledActions: ea, allEnabled: allOn }
      })
      return next
    })
  }

  const toggleAllActions = (connIndex: number, enabled: boolean) => {
    setConnectorEntries((prev) => {
      const next = prev.map((cfg, i) => {
        if (i !== connIndex) return cfg
        const conn = catalog?.[cfg.connectorId]
        if (!conn) return cfg
        if (enabled) {
          return {
            ...cfg,
            enabledActions: conn.actions.map((a) => a.id),
            allEnabled: true,
          }
        }
        return { ...cfg, enabledActions: [], allEnabled: false }
      })
      return next
    })
  }

  /* ── Connector catalog grouped ── */
  const connectorCategories = useMemo(() => {
    if (!catalog) return []
    const q = connectorSearch.toLowerCase()
    const cats: Record<string, ConnectorEntry[]> = {}
    for (const conn of Object.values(catalog)) {
      if (
        q &&
        !conn.name.toLowerCase().includes(q) &&
        !(conn.description || '').toLowerCase().includes(q)
      )
        continue
      const cat = conn.category || 'other'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(conn)
    }
    return sortCategories(Object.keys(cats)).map((cat) => ({
      name: cat,
      items: cats[cat],
    }))
  }, [catalog, connectorSearch])

  const addedConnectorIds = useMemo(
    () => new Set(connectorEntries.map((c) => c.connectorId)),
    [connectorEntries],
  )

  /* ── Selected connector detail ── */
  const selectedConnectorCfg =
    selectedConnectorIndex >= 0
      ? connectorEntries[selectedConnectorIndex]
      : undefined
  const selectedConnectorDef = selectedConnectorCfg
    ? catalog?.[selectedConnectorCfg.connectorId]
    : undefined

  /* ────────────────────────────────────────
   * BROWSE / IMPORT
   * ──────────────────────────────────────── */

  const handleBrowse = async () => {
    try {
      const res = await filesApi.browse()
      if (res.path) setCwd(res.path)
    } catch { /* ignore */ }
  }

  const handleImport = async () => {
    let dir = cwd.trim()
    if (!dir) {
      try {
        const res = await filesApi.browse()
        if (!res.path) return
        dir = res.path
        setCwd(dir)
      } catch {
        return
      }
    }
    setImporting(true)
    try {
      const data = await filesApi.importAgent(dir)
      if (data.name) setName(data.name)
      if (data.purpose) setIdentity(data.purpose)
      if (data.defaultCwd) setCwd(data.defaultCwd)
      if (data.skills?.length) {
        data.skills.forEach((s: string) => addSkillEntry({ name: s, source: 'local' }))
      }
    } catch { /* ignore */ }
    setImporting(false)
  }

  /* ────────────────────────────────────────
   * SUBMIT
   * ──────────────────────────────────────── */

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    /* Compute flat tools list from connectors for backward compat */
    const connectorTools: string[] = []
    if (catalog) {
      for (const cfg of connectorEntries) {
        const conn = catalog[cfg.connectorId]
        if (!conn) continue
        for (const action of conn.actions) {
          if (cfg.allEnabled || cfg.enabledActions?.includes(action.id)) {
            connectorTools.push(action.mcpTool)
          }
        }
      }
    }

    const input = {
      name: trimmedName,
      defaultCwd: cwd.trim(),
      purpose: identity,
      identity,
      constraints,
      skills: skillEntries as (string | TemplateSkill)[],
      tools: connectorTools,
      connectors: connectorEntries,
    }

    if (isEdit && editingTemplateId) {
      await updateMutation.mutateAsync({ id: editingTemplateId, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    closeModal()
  }

  /* ────────────────────────────────────────
   * RENDER
   * ──────────────────────────────────────── */

  const selectedSkill =
    selectedSkillIndex >= 0 ? skillEntries[selectedSkillIndex] : undefined

  const skillBadgeClass = (source: string) => {
    if (source === 'npx') return css.skillDetailBadgeNpx
    if (source === 'external') return css.skillDetailBadgeExternal
    return css.skillDetailBadgeLocal
  }

  const skillChipClass = (entry: SkillEntry, index: number) => {
    let c = css.skillChip
    if (entry.source === 'npx') c += ` ${css.skillChipNpx}`
    if (entry.source === 'external') c += ` ${css.skillChipExternal}`
    if (index === selectedSkillIndex) c += ` ${css.skillChipSelected}`
    return c
  }

  const sourceLabel: Record<string, string> = {
    local: 'local',
    npx: 'installed',
    external: 'catalog',
  }

  return (
    <div className={css.overlay} onClick={closeModal}>
      <div
        className={`${css.modal} ${expanded ? css.expanded : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Expand / Collapse button */}
        <button
          className={css.expandBtn}
          onClick={() => setExpanded((p) => !p)}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '\u2716' : '\u26F6'}
        </button>

        <div className={css.title}>
          {isEdit ? 'edit template' : 'new agent template'}
        </div>
        <div className={css.subtitle}>
          {isEdit
            ? `Editing: ${editTemplate?.name ?? ''}`
            : 'Create a reusable agent configuration'}
        </div>

        {/* Name */}
        <label className={css.label}>name</label>
        <input
          ref={nameRef}
          className={css.input}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Agent"
        />

        {/* Working Directory */}
        <label className={css.label}>working directory</label>
        <div className={css.cwdRow}>
          <PathAutocomplete
            value={cwd}
            onChange={setCwd}
            placeholder="~/Projects/my-app"
          />
          <button className={css.cwdBtn} onClick={handleBrowse}>
            Browse
          </button>
          <button className={css.cwdBtn} onClick={handleImport}>
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>

        {/* Identity */}
        <label className={css.label}>identity (claude.md)</label>
        <textarea
          className={css.textarea}
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder="You are an expert..."
        />

        {/* Constraints */}
        <label className={css.label}>constraints (agents.md)</label>
        <textarea
          className={css.textarea}
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder="Rules and constraints..."
        />

        {/* ── Skills Area ── */}
        <label className={css.label}>skills</label>
        <div className={css.skillsArea}>
          {/* Skill chips */}
          {skillEntries.length > 0 && (
            <div className={css.skillChips}>
              {visibleSkills.map((entry, i) => (
                <span key={entry.name} className={skillChipClass(entry, i)}>
                  <span
                    className={css.chipName}
                    onClick={() => openSkillDetail(i)}
                  >
                    {entry.name}
                  </span>
                  <button
                    className={css.chipRemove}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSkillChip(i)
                    }}
                  >
                    &times;
                  </button>
                </span>
              ))}
              {!skillChipsExpanded && hiddenCount > 0 && (
                <button
                  className={css.skillChipsToggle}
                  onClick={() => setSkillChipsExpanded(true)}
                >
                  +{hiddenCount} more &middot; see all
                </button>
              )}
              {skillChipsExpanded && skillEntries.length > SKILL_CHIPS_LIMIT && (
                <button
                  className={css.skillChipsToggle}
                  onClick={() => setSkillChipsExpanded(false)}
                >
                  show less
                </button>
              )}
            </div>
          )}

          {/* Skill detail panel */}
          {selectedSkill && (
            <div className={css.skillDetailPanel}>
              <button
                className={css.skillDetailClose}
                onClick={() => setSelectedSkillIndex(-1)}
              >
                &times;
              </button>
              <div className={css.skillDetailHeader}>
                <span className={css.skillDetailName}>
                  {selectedSkill.name}
                </span>
                <span
                  className={`${css.skillDetailBadge} ${skillBadgeClass(selectedSkill.source)}`}
                >
                  {sourceLabel[selectedSkill.source] ?? selectedSkill.source}
                </span>
              </div>
              {selectedSkill.installCommand && (
                <div className={css.skillDetailRow}>
                  <label>install command</label>
                  <div className={css.detailCommand}>
                    {selectedSkill.installCommand}
                  </div>
                </div>
              )}
              {selectedSkill.repo && (
                <div className={css.skillDetailRow}>
                  <label>repo</label>
                  <div className={css.detailValue}>{selectedSkill.repo}</div>
                </div>
              )}
              {selectedSkill.path && (
                <div className={css.skillDetailRow}>
                  <label>path</label>
                  <div className={css.detailValue}>{selectedSkill.path}</div>
                </div>
              )}
              <div className={css.skillDetailRow}>
                <label>skill.md</label>
                <textarea
                  className={css.skillDetailTextarea}
                  value={skillDetailContent}
                  onChange={(e) => setSkillDetailContent(e.target.value)}
                  placeholder={
                    skillDetailLoading
                      ? 'Loading...'
                      : 'No local file -- paste or write skill content here...'
                  }
                  disabled={skillDetailLoading}
                />
              </div>
              <div className={css.skillDetailActions}>
                <button
                  className={css.detailRemove}
                  onClick={() => {
                    setSelectedSkillIndex(-1)
                    removeSkillChip(selectedSkillIndex)
                  }}
                >
                  Remove skill
                </button>
                <button onClick={() => setSelectedSkillIndex(-1)}>
                  Cancel
                </button>
                <button
                  className={css.detailSave}
                  disabled={skillDetailContent === skillDetailOriginal}
                  onClick={() => saveSkillDetail(selectedSkillIndex)}
                >
                  {saveLabel}
                </button>
              </div>
            </div>
          )}

          {/* Skill tabs */}
          <div className={css.skillsTabs}>
            <button
              className={`${css.skillsTab} ${skillTab === 'paste' ? css.skillsTabActive : ''}`}
              onClick={() => switchTab('paste')}
            >
              Paste command
            </button>
            <button
              className={`${css.skillsTab} ${skillTab === 'local' ? css.skillsTabActive : ''}`}
              onClick={() => switchTab('local')}
            >
              Local skills
            </button>
            <button
              className={`${css.skillsTab} ${skillTab === 'browse' ? css.skillsTabActive : ''}`}
              onClick={() => switchTab('browse')}
            >
              Browse
            </button>
          </div>

          {/* Paste tab */}
          {skillTab === 'paste' && (
            <div className={css.skillPasteRow}>
              <input
                className={css.input}
                type="text"
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="npx @anthropic/claude-skills add ... --skill my-skill"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    parseAndAddSkillCommand()
                  }
                }}
              />
              <button onClick={parseAndAddSkillCommand}>Add</button>
            </div>
          )}

          {/* Local skills tab */}
          {skillTab === 'local' && (
            <>
              <input
                className={css.pickerSearch}
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search local skills..."
              />
              <div className={css.pickerList}>
                {!localLoaded ? (
                  <div className={css.pickerEmpty}>Loading...</div>
                ) : filteredLocalSkills.length === 0 ? (
                  <div className={css.pickerEmpty}>
                    {localSearch
                      ? 'No matches'
                      : 'No local skills found across agents'}
                  </div>
                ) : (
                  filteredLocalSkills.map((s) => {
                    const added = addedSkillNames.has(s.name)
                    return (
                      <div
                        key={s.name}
                        className={`${css.pickerItem} ${added ? css.pickerItemAdded : ''}`}
                        onClick={() =>
                          addSkillEntry({
                            name: s.name,
                            source: 'local',
                            path: s.path || undefined,
                            description: s.description || undefined,
                          })
                        }
                      >
                        <span className={css.pickerName}>{s.name}</span>
                        <span className={css.pickerDesc}>
                          {s.description || s.folder}
                        </span>
                        <span className={css.pickerBadge}>
                          {s.sourceAgent || ''}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}

          {/* External skills tab */}
          {skillTab === 'browse' && (
            <>
              <input
                className={css.pickerSearch}
                type="text"
                value={externalSearch}
                onChange={(e) => setExternalSearch(e.target.value)}
                placeholder="Search catalog..."
              />
              <div className={css.pickerList}>
                {!externalLoaded ? (
                  <div className={css.pickerEmpty}>
                    Loading from GitHub...
                  </div>
                ) : filteredExternalSkills.length === 0 ? (
                  <div className={css.pickerEmpty}>
                    {externalSearch
                      ? 'No matches'
                      : 'Could not load external skills'}
                  </div>
                ) : (
                  filteredExternalSkills.map((s) => {
                    const added = addedSkillNames.has(s.name)
                    return (
                      <div
                        key={s.name}
                        className={`${css.pickerItem} ${added ? css.pickerItemAdded : ''}`}
                        onClick={() =>
                          addSkillEntry({
                            name: s.name,
                            source: 'external',
                            repo: s.repo,
                            installCommand: s.installCommand,
                          })
                        }
                      >
                        <span className={css.pickerName}>{s.name}</span>
                        <span className={css.pickerDesc}>{s.repo}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Connectors Area ── */}
        <label className={css.label}>connectors</label>
        <div className={css.connectorsArea}>
          {/* Connector chips */}
          {connectorEntries.length > 0 && (
            <div className={css.connectorChips}>
              {connectorEntries.map((cfg, i) => {
                const conn = catalog?.[cfg.connectorId]
                if (!conn) return null
                const total = conn.actions.length
                const enabled = cfg.allEnabled
                  ? total
                  : cfg.enabledActions?.length || 0
                return (
                  <div
                    key={cfg.connectorId}
                    className={`${css.connectorChip} ${i === selectedConnectorIndex ? css.connectorChipSelected : ''}`}
                  >
                    <span className={css.connectorChipIcon}>{conn.icon}</span>
                    <span
                      className={css.chipName}
                      onClick={() => setSelectedConnectorIndex(i)}
                    >
                      {conn.name}
                    </span>
                    <span className={css.connectorChipCount}>
                      {enabled}/{total}
                    </span>
                    <button
                      className={css.chipRemove}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeConnector(i)
                      }}
                    >
                      &times;
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Connector detail panel */}
          {selectedConnectorCfg && selectedConnectorDef && (
            <div className={css.connectorDetailPanel}>
              <button
                className={css.connectorDetailClose}
                onClick={() => setSelectedConnectorIndex(-1)}
              >
                &times;
              </button>
              <div className={css.connectorDetailHeader}>
                <span className={css.connectorDetailIcon}>
                  {selectedConnectorDef.icon}
                </span>
                <span className={css.connectorDetailName}>
                  {selectedConnectorDef.name}
                </span>
                <span className={css.connectorDetailDesc}>
                  {selectedConnectorDef.description}
                </span>
              </div>
              <div className={css.connectorToggleAll}>
                <span>Enable all actions</span>
                <label className={css.toggle}>
                  <input
                    className={css.toggleInput}
                    type="checkbox"
                    checked={
                      selectedConnectorCfg.allEnabled ||
                      selectedConnectorCfg.enabledActions?.length ===
                        selectedConnectorDef.actions.length
                    }
                    onChange={(e) =>
                      toggleAllActions(
                        selectedConnectorIndex,
                        e.target.checked,
                      )
                    }
                  />
                  <span className={css.toggleTrack} />
                </label>
              </div>
              {selectedConnectorDef.actions.map((action) => {
                const checked =
                  selectedConnectorCfg.allEnabled ||
                  selectedConnectorCfg.enabledActions?.includes(action.id) ||
                  false
                return (
                  <div key={action.id} className={css.connectorActionRow}>
                    <span className={css.actionName}>{action.name}</span>
                    <span className={css.actionMcp} title={action.mcpTool}>
                      {action.mcpTool}
                    </span>
                    <label className={css.toggle}>
                      <input
                        className={css.toggleInput}
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          toggleAction(
                            selectedConnectorIndex,
                            action.id,
                            e.target.checked,
                          )
                        }
                      />
                      <span className={css.toggleTrack} />
                    </label>
                  </div>
                )
              })}
            </div>
          )}

          {/* Connector catalog picker */}
          <input
            className={css.pickerSearch}
            type="text"
            value={connectorSearch}
            onChange={(e) => setConnectorSearch(e.target.value)}
            placeholder="Search connectors..."
          />
          <div className={css.connectorPickerList}>
            {connectorCategories.length === 0 ? (
              <div className={css.pickerEmpty}>No connectors found</div>
            ) : (
              connectorCategories.map((cat) => (
                <div key={cat.name}>
                  <div className={css.connectorCategoryHeader}>{cat.name}</div>
                  {cat.items.map((conn) => {
                    const added = addedConnectorIds.has(conn.id)
                    return (
                      <div
                        key={conn.id}
                        className={`${css.connectorPickerItem} ${added ? css.connectorPickerItemAdded : ''}`}
                        onClick={() => addConnector(conn.id)}
                      >
                        <span className={css.connectorPickerIcon}>
                          {conn.icon}
                        </span>
                        <span className={css.pickerName}>{conn.name}</span>
                        <span className={css.pickerDesc}>
                          {conn.description}
                        </span>
                        <span className={css.pickerBadge}>
                          {conn.actions.length} actions
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Modal Actions ── */}
        <div className={css.modalActions}>
          <button onClick={closeModal}>Cancel</button>
          <button
            className={css.btnSubmit}
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
