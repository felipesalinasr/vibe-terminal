import { apiRequest } from './client.ts'
import type { ConnectorCatalog } from '@/types/index.ts'

export function getCatalog(): Promise<ConnectorCatalog> {
  return apiRequest('/api/connectors/catalog')
}
