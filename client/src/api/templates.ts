import { apiRequest } from './client.ts'
import { API } from './paths.ts'
import type { Template, TemplateInput } from '@/types/index.ts'

export function listTemplates(): Promise<Template[]> {
  return apiRequest(API.templates)
}

export function createTemplate(input: TemplateInput): Promise<Template> {
  return apiRequest(API.templates, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTemplate(id: string, input: Partial<TemplateInput>): Promise<Template> {
  return apiRequest(API.template(id), {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteTemplate(id: string): Promise<void> {
  return apiRequest(API.template(id), { method: 'DELETE' })
}
