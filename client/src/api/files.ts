import { apiRequest } from './client.ts'
import { API } from './paths.ts'
import type { AutocompleteResponse, BrowseResponse, ImportAgentResponse, DropResponse } from '@/types/index.ts'

export function dropFile(file: File): Promise<DropResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest(API.drop, {
    method: 'POST',
    body: formData,
  })
}

export function openFile(path: string, action: 'file' | 'folder' = 'file'): Promise<void> {
  return apiRequest(API.open, {
    method: 'POST',
    body: JSON.stringify({ path, action }),
  })
}

export function browse(): Promise<BrowseResponse> {
  return apiRequest(API.browse)
}

export function importAgent(path: string): Promise<ImportAgentResponse> {
  return apiRequest(`${API.importAgent}?path=${encodeURIComponent(path)}`)
}

export function autocomplete(path: string): Promise<AutocompleteResponse> {
  return apiRequest(`${API.autocomplete}?path=${encodeURIComponent(path)}`)
}
