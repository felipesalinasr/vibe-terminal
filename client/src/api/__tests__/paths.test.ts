import { describe, it, expect } from 'vitest'
import { API } from '../paths.ts'

describe('API paths', () => {
  // Collect all static (string) paths and dynamic (function) paths
  const staticEntries = Object.entries(API).filter(
    ([, v]) => typeof v === 'string',
  ) as [string, string][]

  const dynamicEntries = Object.entries(API).filter(
    ([, v]) => typeof v === 'function',
  ) as [string, (...args: string[]) => string][]

  describe('static paths', () => {
    it.each(staticEntries)(
      '%s starts with /api/',
      (_key, path) => {
        expect(path).toMatch(/^\/api\//)
      },
    )
  })

  describe('dynamic path functions', () => {
    it.each(dynamicEntries)(
      '%s returns a string starting with /api/',
      (_key, fn) => {
        // Call with placeholder args (functions take 1 or 2 string args)
        const result = fn('test-id', 'test-folder')
        expect(typeof result).toBe('string')
        expect(result).toMatch(/^\/api\//)
      },
    )
  })

  describe('key path values', () => {
    it('sessions path', () => {
      expect(API.sessions).toBe('/api/sessions')
    })

    it('session detail path', () => {
      expect(API.session('abc-123')).toBe('/api/sessions/abc-123')
    })

    it('autocomplete path', () => {
      expect(API.autocomplete).toBe('/api/autocomplete')
    })

    it('agent path', () => {
      expect(API.agent('s1')).toBe('/api/agents/s1')
    })

    it('agent purpose path', () => {
      expect(API.agentPurpose('s1')).toBe('/api/agents/s1/purpose')
    })

    it('agent agents-md path', () => {
      expect(API.agentAgentsMd('s1')).toBe('/api/agents/s1/agents-md')
    })

    it('agent skills path', () => {
      expect(API.agentSkills('s1')).toBe('/api/agents/s1/skills')
    })

    it('agent skill with folder path', () => {
      expect(API.agentSkill('s1', 'my-skill')).toBe('/api/agents/s1/skills/my-skill')
    })

    it('agent files path', () => {
      expect(API.agentFiles('s1')).toBe('/api/agents/s1/files')
    })

    it('agent knowledge path', () => {
      expect(API.agentKnowledge('s1')).toBe('/api/agents/s1/knowledge')
    })

    it('agent knowledge file path', () => {
      expect(API.agentKbFile('s1', 'notes.txt')).toBe('/api/agents/s1/knowledge/notes.txt')
    })

    it('agent memory path', () => {
      expect(API.agentMemory('s1')).toBe('/api/agents/s1/memory')
    })

    it('agent audit path', () => {
      expect(API.agentAudit('s1')).toBe('/api/agents/s1/audit')
    })

    it('skills path', () => {
      expect(API.skills).toBe('/api/skills')
    })

    it('skills external path', () => {
      expect(API.skillsExternal).toBe('/api/skills/external')
    })

    it('skill content path', () => {
      expect(API.skillContent).toBe('/api/skill-content')
    })

    it('templates path', () => {
      expect(API.templates).toBe('/api/templates')
    })

    it('template detail path', () => {
      expect(API.template('t1')).toBe('/api/templates/t1')
    })

    it('connector catalog path', () => {
      expect(API.connectorCatalog).toBe('/api/connectors/catalog')
    })

    it('connector sync path', () => {
      expect(API.connectorSync).toBe('/api/connectors/sync')
    })

    it('drop path', () => {
      expect(API.drop).toBe('/api/drop')
    })

    it('browse path', () => {
      expect(API.browse).toBe('/api/browse')
    })

    it('open path', () => {
      expect(API.open).toBe('/api/open')
    })

    it('import agent path', () => {
      expect(API.importAgent).toBe('/api/import-agent')
    })

    it('health path', () => {
      expect(API.health).toBe('/api/health')
    })

    it('scrollback path', () => {
      expect(API.scrollback('s1')).toBe('/api/sessions/s1/scrollback')
    })
  })

  describe('completeness', () => {
    it('has no undefined or null values', () => {
      for (const [key, value] of Object.entries(API)) {
        expect(value, `API.${key} should be defined`).toBeDefined()
        expect(value, `API.${key} should not be null`).not.toBeNull()
      }
    })
  })
})
