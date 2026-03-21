import { useUiStore } from '@/stores/ui.ts'
import { useAgentConfig, useAgentConstraints } from '@/hooks/useAgentConfig.ts'
import { IdentitySection } from './IdentitySection.tsx'
import { ConstraintsSection } from './ConstraintsSection.tsx'
import { SkillsSection } from './SkillsSection.tsx'
import { ToolsSection } from './ToolsSection.tsx'
import { FilesSection } from './FilesSection.tsx'
import { KnowledgeSection } from './KnowledgeSection.tsx'
import { MemorySection } from './MemorySection.tsx'
import { AuditSection } from './AuditSection.tsx'
import type { AgentSection } from '@/stores/ui.ts'
import css from './AgentEditor.module.css'

const NAV_ITEMS: { key: AgentSection; label: string }[] = [
  { key: 'identity', label: 'Identity' },
  { key: 'constraints', label: 'Constraints' },
  { key: 'skills', label: 'Skills' },
  { key: 'tools', label: 'Tools' },
  { key: 'files', label: 'Files' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'memory', label: 'Memory' },
  { key: 'audit', label: 'Audit' },
]

interface AgentEditorProps {
  sessionId: string
}

export function AgentEditor({ sessionId }: AgentEditorProps) {
  const agentSection = useUiStore((s) => s.agentSection)
  const setAgentSection = useUiStore((s) => s.setAgentSection)

  // Pre-fetch config and constraints so child sections have cached data
  useAgentConfig(sessionId)
  useAgentConstraints(sessionId)

  return (
    <div className={css.wrapper}>
      {/* Sidebar */}
      <nav className={css.sidebar}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`${css.navItem} ${agentSection === item.key ? css.navItemActive : ''}`}
            onClick={() => setAgentSection(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className={css.content}>
        <SectionRouter section={agentSection} sessionId={sessionId} />
      </div>
    </div>
  )
}

function SectionRouter({
  section,
  sessionId,
}: {
  section: AgentSection
  sessionId: string
}) {
  switch (section) {
    case 'identity':
      return <IdentitySection sessionId={sessionId} />
    case 'constraints':
      return <ConstraintsSection sessionId={sessionId} />
    case 'skills':
      return <SkillsSection sessionId={sessionId} />
    case 'tools':
      return <ToolsSection sessionId={sessionId} />
    case 'files':
      return <FilesSection sessionId={sessionId} />
    case 'knowledge':
      return <KnowledgeSection sessionId={sessionId} />
    case 'memory':
      return <MemorySection sessionId={sessionId} />
    case 'audit':
      return <AuditSection sessionId={sessionId} />
    default:
      return null
  }
}
