import { apiRequest } from './client.ts'
import type { AutocompleteResponse, BrowseResponse, ImportAgentResponse, DropResponse } from '@/types/index.ts'

export function dropFile(file: File): Promise<DropResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest('/api/drop', {
    method: 'POST',
    body: formData,
  })
}

export function openFile(path: string, action: 'file' | 'folder' = 'file'): Promise<void> {
  return apiRequest('/api/open', {
    method: 'POST',
    body: JSON.stringify({ path, action }),
  })
}

export function browse(): Promise<BrowseResponse> {
  return apiRequest('/api/browse')
}

export function importAgent(path: string): Promise<ImportAgentResponse> {
  return apiRequest(`/api/import-agent?path=${encodeURIComponent(path)}`)
}

export function autocomplete(path: string): Promise<AutocompleteResponse> {
  return apiRequest(`/api/autocomplete?path=${encodeURIComponent(path)}`)
}
