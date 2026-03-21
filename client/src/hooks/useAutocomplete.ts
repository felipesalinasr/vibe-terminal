import { useQuery } from '@tanstack/react-query'
import * as filesApi from '@/api/files.ts'

export function useAutocomplete(path: string, enabled = true) {
  return useQuery({
    queryKey: ['autocomplete', path],
    queryFn: () => filesApi.autocomplete(path),
    enabled: enabled && path.length > 0,
    staleTime: 5_000,
  })
}
