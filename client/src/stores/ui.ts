import { create } from 'zustand'

export type View = 'board' | 'agents' | 'tools'
export type PanelTab = 'terminal' | 'agent'
export type AgentSection = 'identity' | 'constraints' | 'skills' | 'tools' | 'files' | 'knowledge' | 'memory' | 'audit'
export type ModalType = 'createTask' | 'template' | 'startSession' | null

interface UiState {
  currentView: View
  setView: (view: View) => void

  panelOpen: boolean
  panelSessionId: string | null
  panelTab: PanelTab
  openPanel: (sessionId: string) => void
  closePanel: () => void
  setPanelTab: (tab: PanelTab) => void

  agentSection: AgentSection
  setAgentSection: (section: AgentSection) => void

  activeModal: ModalType
  openModal: (modal: ModalType) => void
  closeModal: () => void

  editingTemplateId: string | null
  setEditingTemplateId: (id: string | null) => void

  startSessionCardId: number | null
  pendingTemplateId: string | null
  openStartSession: (cardId: number | null, templateId?: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  currentView: 'board',
  setView: (view) => set({ currentView: view }),

  panelOpen: false,
  panelSessionId: null,
  panelTab: 'terminal',
  openPanel: (sessionId) => set({
    panelOpen: true,
    panelSessionId: sessionId,
    panelTab: 'terminal',
    agentSection: 'identity',
  }),
  closePanel: () => set({
    panelOpen: false,
    panelSessionId: null,
  }),
  setPanelTab: (tab) => set({ panelTab: tab }),

  agentSection: 'identity',
  setAgentSection: (section) => set({ agentSection: section }),

  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null, editingTemplateId: null }),

  editingTemplateId: null,
  setEditingTemplateId: (id) => set({ editingTemplateId: id }),

  startSessionCardId: null,
  pendingTemplateId: null,
  openStartSession: (cardId, templateId = null) => set({
    activeModal: 'startSession',
    startSessionCardId: cardId,
    pendingTemplateId: templateId ?? null,
  }),
}))
