import { useEffect, useCallback } from 'react'
import { useUiStore } from '@/stores/ui.ts'
import { useSession, useDeleteSession } from '@/hooks/useSessions.ts'
import { XtermTerminal } from '@/features/terminal/index.ts'
import { AgentEditor } from '@/features/agent-editor/index.ts'
import type { PanelTab } from '@/stores/ui.ts'
import type { SessionStatus } from '@/types/index.ts'
import css from './SidePanel.module.css'

function modeDotClass(status: SessionStatus | undefined): string {
  switch (status) {
    case 'active':
      return css.modeDotActive
    case 'review':
      return css.modeDotReview
    case 'done':
      return css.modeDotDone
    default:
      return css.modeDotDefault
  }
}

function modeLabel(status: SessionStatus | undefined): string {
  switch (status) {
    case 'active':
      return 'active'
    case 'review':
      return 'waiting for review'
    case 'done':
      return 'completed'
    case 'historical':
      return 'historical'
    default:
      return 'unknown'
  }
}

export function SidePanel() {
  const panelOpen = useUiStore((s) => s.panelOpen)
  const panelSessionId = useUiStore((s) => s.panelSessionId)
  const panelTab = useUiStore((s) => s.panelTab)
  const closePanel = useUiStore((s) => s.closePanel)
  const setPanelTab = useUiStore((s) => s.setPanelTab)

  const { data: session } = useSession(panelSessionId)
  const deleteSession = useDeleteSession()

  /* Escape key closes panel */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panelOpen) {
        closePanel()
      }
    },
    [panelOpen, closePanel],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  /* Kill session */
  const handleKill = useCallback(async () => {
    if (!panelSessionId) return
    await deleteSession.mutateAsync(panelSessionId)
    closePanel()
  }, [panelSessionId, deleteSession, closePanel])

  const sessionName = session?.name ?? 'Agent'
  const sessionId = panelSessionId
    ? panelSessionId.slice(0, 8)
    : '---'

  return (
    <>
      {/* Overlay */}
      <div
        className={`${css.overlay} ${panelOpen ? css.overlayOpen : ''}`}
        onClick={closePanel}
      />

      {/* Panel */}
      <div className={`${css.panel} ${panelOpen ? css.panelOpen : ''}`}>
        {/* Header */}
        <div className={css.header}>
          <div className={css.headerLeft}>
            <span className={css.title}>{sessionName}</span>
            <span className={css.sessionBadge}>{sessionId}</span>
            <div className={css.tabs}>
              <TabButton
                label="Terminal"
                tab="terminal"
                active={panelTab === 'terminal'}
                onClick={setPanelTab}
              />
              <TabButton
                label="Agent"
                tab="agent"
                active={panelTab === 'agent'}
                onClick={setPanelTab}
              />
            </div>
          </div>
          <div className={css.headerRight}>
            <button className={css.btnClose} onClick={handleKill}>
              Kill
            </button>
            <button className={css.btnClose} onClick={closePanel}>
              ESC &times;
            </button>
          </div>
        </div>

        {/* Tab: Terminal */}
        {panelTab === 'terminal' && panelSessionId && (
          <div className={css.tabContent}>
            <XtermTerminal sessionId={panelSessionId} />
          </div>
        )}

        {/* Tab: Agent */}
        {panelTab === 'agent' && panelSessionId && (
          <div className={css.tabContent}>
            <AgentEditor sessionId={panelSessionId} />
          </div>
        )}

        {/* Footer */}
        <div className={css.footer}>
          <div className={css.modeBar}>
            <div
              className={`${css.modeDot} ${modeDotClass(session?.status)}`}
            />
            <span>{modeLabel(session?.status)}</span>
          </div>
        </div>
      </div>
    </>
  )
}

/* ── Tab Button ── */

interface TabButtonProps {
  label: string
  tab: PanelTab
  active: boolean
  onClick: (tab: PanelTab) => void
}

function TabButton({ label, tab, active, onClick }: TabButtonProps) {
  return (
    <button
      className={`${css.tab} ${active ? css.tabActive : ''}`}
      onClick={() => onClick(tab)}
    >
      {label}
    </button>
  )
}
