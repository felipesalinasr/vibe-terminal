import { apiRequest } from './client.ts'
import { API } from './paths.ts'
import type { ConnectorCatalog } from '@/types/index.ts'

export function getCatalog(): Promise<ConnectorCatalog> {
  return apiRequest(API.connectorCatalog)
}
