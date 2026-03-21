import { useQuery } from '@tanstack/react-query'
import * as connectorsApi from '@/api/connectors.ts'

export const connectorKeys = {
  catalog: ['connectors', 'catalog'] as const,
}

export function useConnectorCatalog() {
  return useQuery({
    queryKey: connectorKeys.catalog,
    queryFn: connectorsApi.getCatalog,
    staleTime: Infinity,
  })
}
