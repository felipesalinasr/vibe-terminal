import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as templatesApi from '@/api/templates.ts'
import type { TemplateInput } from '@/types/index.ts'

export const templateKeys = {
  all: ['templates'] as const,
}

export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: templatesApi.listTemplates,
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TemplateInput) => templatesApi.createTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TemplateInput> }) =>
      templatesApi.updateTemplate(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => templatesApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  })
}
