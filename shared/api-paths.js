/**
 * Shared API path constants.
 * Import from both server routes and frontend client to avoid hardcoded strings.
 * When migrating to TypeScript, rename to api-paths.ts for type safety.
 */

export const API = {
  // Sessions
  sessions:       '/api/sessions',
  session:        (id) => `/api/sessions/${id}`,
  autocomplete:   '/api/autocomplete',

  // Agents
  agent:          (id) => `/api/agents/${id}`,
  agentPurpose:   (id) => `/api/agents/${id}/purpose`,
  agentAgentsMd:  (id) => `/api/agents/${id}/agents-md`,
  agentSkills:    (id) => `/api/agents/${id}/skills`,
  agentSkill:     (id, folder) => `/api/agents/${id}/skills/${folder}`,
  agentFiles:     (id) => `/api/agents/${id}/files`,
  agentKnowledge: (id) => `/api/agents/${id}/knowledge`,
  agentKbFile:    (id, filename) => `/api/agents/${id}/knowledge/${filename}`,
  agentMemory:    (id) => `/api/agents/${id}/memory`,
  agentAudit:     (id) => `/api/agents/${id}/audit`,

  // Skills (global)
  skills:         '/api/skills',
  skillsExternal: '/api/skills/external',
  skillContent:   '/api/skill-content',

  // Templates
  templates:      '/api/templates',
  template:       (id) => `/api/templates/${id}`,

  // Connectors
  connectorCatalog: '/api/connectors/catalog',
  connectorSync:    '/api/connectors/sync',

  // Files
  drop:           '/api/drop',
  browse:         '/api/browse',
  open:           '/api/open',
  importAgent:    '/api/import-agent',

  // System
  health:         '/api/health',
  scrollback:     (id) => `/api/sessions/${id}/scrollback`,
};
