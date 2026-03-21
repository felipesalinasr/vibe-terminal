import { useNavigate } from 'react-router-dom'
import { useUiStore } from '@/stores/ui.ts'
import { useSessions } from '@/hooks/useSessions.ts'
import type { View } from '@/stores/ui.ts'
import type { ModalType } from '@/stores/ui.ts'
import css from './Header.module.css'

const NAV_TABS: { view: View; label: string }[] = [
  { view: 'board', label: 'Board' },
  { view: 'agents', label: 'Agents' },
  { view: 'tools', label: 'Tools' },
]

const ACTION_CONFIG: Record<View, { label: string; modal: ModalType }> = {
  board: { label: '+ New Task', modal: 'createTask' },
  agents: { label: '+ New Agent', modal: 'template' },
  tools: { label: '+ Add Tool', modal: 'createTask' },
}

export function Header() {
  const navigate = useNavigate()
  const currentView = useUiStore((s) => s.currentView)
  const setView = useUiStore((s) => s.setView)
  const openModal = useUiStore((s) => s.openModal)
  const { data: sessions } = useSessions()

  const liveCount = sessions?.filter((s) => s.status !== 'historical').length ?? 0
  const activeCount = sessions?.filter((s) => s.status === 'active').length ?? 0
  const historicalCount = sessions?.filter((s) => s.status === 'historical').length ?? 0

  function handleNavClick(view: View) {
    setView(view)
    const paths: Record<View, string> = {
      board: '/',
      agents: '/agents',
      tools: '/tools',
    }
    navigate(paths[view])
  }

  function handleAction() {
    const config = ACTION_CONFIG[currentView]
    openModal(config.modal)
  }

  return (
    <header className={css.header}>
      <div className={css.headerLeft}>
        <span className={css.logo}>vibe terminal</span>
        <span className={css.cursorBlink} />
        <nav className={css.headerNav}>
          {NAV_TABS.map((tab) => (
            <button
              key={tab.view}
              className={`${css.headerNavBtn}${currentView === tab.view ? ` ${css.headerNavBtnActive}` : ''}`}
              onClick={() => handleNavClick(tab.view)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <span className={css.headerMeta}>
          <span className={css.headerMetaHighlight}>{liveCount}</span> agents
          {' \u00b7 '}
          <span className={css.headerMetaHighlight}>{activeCount}</span> in progress
          {historicalCount > 0 && (
            <>
              {' \u00b7 '}
              <span className={css.headerMetaHighlight}>{historicalCount}</span> archived
            </>
          )}
        </span>
      </div>
      <button className={css.btnAction} onClick={handleAction}>
        {ACTION_CONFIG[currentView].label}
      </button>
    </header>
  )
}
