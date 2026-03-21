/**
 * Typed API paths — mirrors shared/api-paths.js.
 * Single source of truth for all client-side endpoint URLs.
 */
export const API = {
  // Sessions
  sessions: '/api/sessions',
  session: (id: string) => `/api/sessions/${id}`,
  autocomplete: '/api/autocomplete',

  // Agents
  agent: (id: string) => `/api/agents/${id}`,
  agentPurpose: (id: string) => `/api/agents/${id}/purpose`,
  agentAgentsMd: (id: string) => `/api/agents/${id}/agents-md`,
  agentSkills: (id: string) => `/api/agents/${id}/skills`,
  agentSkill: (id: string, folder: string) => `/api/agents/${id}/skills/${folder}`,
  agentFiles: (id: string) => `/api/agents/${id}/files`,
  agentKnowledge: (id: string) => `/api/agents/${id}/knowledge`,
  agentKbFile: (id: string, filename: string) => `/api/agents/${id}/knowledge/${filename}`,
  agentMemory: (id: string) => `/api/agents/${id}/memory`,
  agentAudit: (id: string) => `/api/agents/${id}/audit`,

  // Skills (global)
  skills: '/api/skills',
  skillsExternal: '/api/skills/external',
  skillContent: '/api/skill-content',

  // Templates
  templates: '/api/templates',
  template: (id: string) => `/api/templates/${id}`,

  // Connectors
  connectorCatalog: '/api/connectors/catalog',
  connectorSync: '/api/connectors/sync',

  // Files
  drop: '/api/drop',
  browse: '/api/browse',
  open: '/api/open',
  importAgent: '/api/import-agent',

  // System
  health: '/api/health',
  scrollback: (id: string) => `/api/sessions/${id}/scrollback`,
} as const
