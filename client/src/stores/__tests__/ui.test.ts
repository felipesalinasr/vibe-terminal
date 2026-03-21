import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from '../ui.ts'
import type { PanelTab, ModalType, View, AgentSection } from '../ui.ts'

// Helper to get a clean initial state snapshot
function getInitialState() {
  return {
    currentView: 'board' as View,
    panelOpen: false,
    panelSessionId: null as string | null,
    panelTab: 'terminal' as PanelTab,
    agentSection: 'identity' as AgentSection,
    activeModal: null as ModalType,
    editingTemplateId: null as string | null,
    startSessionCardId: null as number | null,
    pendingTemplateId: null as string | null,
  }
}

describe('useUiStore', () => {
  beforeEach(() => {
    // Reset to initial state
    useUiStore.setState(getInitialState())
  })

  describe('setView', () => {
    it('changes the current view', () => {
      useUiStore.getState().setView('agents')
      expect(useUiStore.getState().currentView).toBe('agents')
    })

    it('can switch between all views', () => {
      const views: View[] = ['board', 'agents', 'tools']
      for (const view of views) {
        useUiStore.getState().setView(view)
        expect(useUiStore.getState().currentView).toBe(view)
      }
    })
  })

  describe('openPanel', () => {
    it('sets panelOpen to true', () => {
      useUiStore.getState().openPanel('sess-1')
      expect(useUiStore.getState().panelOpen).toBe(true)
    })

    it('sets the panelSessionId', () => {
      useUiStore.getState().openPanel('sess-1')
      expect(useUiStore.getState().panelSessionId).toBe('sess-1')
    })

    it('resets panelTab to terminal', () => {
      useUiStore.setState({ panelTab: 'agent' })
      useUiStore.getState().openPanel('sess-2')
      expect(useUiStore.getState().panelTab).toBe('terminal')
    })

    it('resets agentSection to identity', () => {
      useUiStore.setState({ agentSection: 'skills' })
      useUiStore.getState().openPanel('sess-3')
      expect(useUiStore.getState().agentSection).toBe('identity')
    })

    it('can switch to a different session', () => {
      useUiStore.getState().openPanel('sess-1')
      expect(useUiStore.getState().panelSessionId).toBe('sess-1')

      useUiStore.getState().openPanel('sess-2')
      expect(useUiStore.getState().panelSessionId).toBe('sess-2')
      expect(useUiStore.getState().panelOpen).toBe(true)
    })
  })

  describe('closePanel', () => {
    it('sets panelOpen to false', () => {
      useUiStore.getState().openPanel('sess-1')
      useUiStore.getState().closePanel()
      expect(useUiStore.getState().panelOpen).toBe(false)
    })

    it('clears panelSessionId', () => {
      useUiStore.getState().openPanel('sess-1')
      useUiStore.getState().closePanel()
      expect(useUiStore.getState().panelSessionId).toBeNull()
    })

    it('does not reset panelTab (preserves for next open)', () => {
      useUiStore.setState({ panelTab: 'agent' })
      useUiStore.getState().closePanel()
      // panelTab is not explicitly reset by closePanel
      expect(useUiStore.getState().panelTab).toBe('agent')
    })
  })

  describe('setPanelTab', () => {
    it('changes the panel tab to terminal', () => {
      useUiStore.setState({ panelTab: 'agent' })
      useUiStore.getState().setPanelTab('terminal')
      expect(useUiStore.getState().panelTab).toBe('terminal')
    })

    it('changes the panel tab to agent', () => {
      useUiStore.getState().setPanelTab('agent')
      expect(useUiStore.getState().panelTab).toBe('agent')
    })
  })

  describe('setAgentSection', () => {
    it('changes the agent section', () => {
      useUiStore.getState().setAgentSection('skills')
      expect(useUiStore.getState().agentSection).toBe('skills')
    })

    it('supports all section values', () => {
      const sections: AgentSection[] = [
        'identity', 'constraints', 'skills', 'tools',
        'files', 'knowledge', 'memory', 'audit',
      ]
      for (const section of sections) {
        useUiStore.getState().setAgentSection(section)
        expect(useUiStore.getState().agentSection).toBe(section)
      }
    })
  })

  describe('openModal', () => {
    it('sets the activeModal', () => {
      useUiStore.getState().openModal('createTask')
      expect(useUiStore.getState().activeModal).toBe('createTask')
    })

    it('supports template modal', () => {
      useUiStore.getState().openModal('template')
      expect(useUiStore.getState().activeModal).toBe('template')
    })

    it('supports startSession modal', () => {
      useUiStore.getState().openModal('startSession')
      expect(useUiStore.getState().activeModal).toBe('startSession')
    })
  })

  describe('closeModal', () => {
    it('sets activeModal to null', () => {
      useUiStore.getState().openModal('createTask')
      useUiStore.getState().closeModal()
      expect(useUiStore.getState().activeModal).toBeNull()
    })

    it('clears editingTemplateId', () => {
      useUiStore.setState({ editingTemplateId: 'tmpl-1' })
      useUiStore.getState().closeModal()
      expect(useUiStore.getState().editingTemplateId).toBeNull()
    })
  })

  describe('setEditingTemplateId', () => {
    it('sets the editing template id', () => {
      useUiStore.getState().setEditingTemplateId('tmpl-99')
      expect(useUiStore.getState().editingTemplateId).toBe('tmpl-99')
    })

    it('can be cleared by passing null', () => {
      useUiStore.getState().setEditingTemplateId('tmpl-99')
      useUiStore.getState().setEditingTemplateId(null)
      expect(useUiStore.getState().editingTemplateId).toBeNull()
    })
  })

  describe('openStartSession', () => {
    it('sets activeModal to startSession', () => {
      useUiStore.getState().openStartSession(5)
      expect(useUiStore.getState().activeModal).toBe('startSession')
    })

    it('sets startSessionCardId', () => {
      useUiStore.getState().openStartSession(42)
      expect(useUiStore.getState().startSessionCardId).toBe(42)
    })

    it('sets pendingTemplateId when provided', () => {
      useUiStore.getState().openStartSession(1, 'tmpl-abc')
      expect(useUiStore.getState().pendingTemplateId).toBe('tmpl-abc')
    })

    it('defaults pendingTemplateId to null when not provided', () => {
      useUiStore.getState().openStartSession(1)
      expect(useUiStore.getState().pendingTemplateId).toBeNull()
    })

    it('accepts null cardId', () => {
      useUiStore.getState().openStartSession(null, 'tmpl-1')
      expect(useUiStore.getState().startSessionCardId).toBeNull()
      expect(useUiStore.getState().pendingTemplateId).toBe('tmpl-1')
    })
  })

  describe('initial state', () => {
    it('starts with board view', () => {
      expect(useUiStore.getState().currentView).toBe('board')
    })

    it('starts with panel closed', () => {
      expect(useUiStore.getState().panelOpen).toBe(false)
      expect(useUiStore.getState().panelSessionId).toBeNull()
    })

    it('starts with terminal tab', () => {
      expect(useUiStore.getState().panelTab).toBe('terminal')
    })

    it('starts with no modal', () => {
      expect(useUiStore.getState().activeModal).toBeNull()
    })
  })
})
