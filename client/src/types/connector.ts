export interface ConnectorAction {
  id: string
  name: string
  mcpTool: string
}

export interface ConnectorEntry {
  id: string
  name: string
  description: string
  icon: string
  category: string
  actions: ConnectorAction[]
}

export type ConnectorCatalog = Record<string, ConnectorEntry>
