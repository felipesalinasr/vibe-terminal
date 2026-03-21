export interface TemplateSkill {
  name: string
  source?: string
  installCommand?: string
  repo?: string
  path?: string
}

export interface TemplateConnector {
  connectorId: string
  allEnabled?: boolean
  enabledActions?: string[]
}

export interface Template {
  id: string
  name: string
  defaultCwd: string
  purpose: string
  identity: string
  constraints: string
  skills: (string | TemplateSkill)[]
  tools: string[]
  connectors: TemplateConnector[]
}

export interface TemplateInput {
  name: string
  defaultCwd?: string
  purpose?: string
  identity?: string
  constraints?: string
  skills?: (string | TemplateSkill)[]
  tools?: string[]
  connectors?: TemplateConnector[]
}
