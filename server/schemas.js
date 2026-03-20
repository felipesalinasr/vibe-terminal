import { z } from 'zod';

export const createSessionSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  cwd: z.string().optional(),
  templateId: z.string().optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  skills: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
}).passthrough();

export const purposeSchema = z.object({
  content: z.string(),
});

export const agentsMdSchema = z.object({
  content: z.string(),
});

export const skillContentWriteSchema = z.object({
  content: z.string(),
  path: z.string().min(1, 'path is required'),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  defaultCwd: z.string().optional().default(''),
  purpose: z.string().optional().default(''),
  identity: z.string().optional().default(''),
  constraints: z.string().optional().default(''),
  skills: z.array(z.union([z.string(), z.object({ name: z.string() })])).optional().default([]),
  tools: z.array(z.string()).optional().default([]),
  connectors: z.array(z.object({
    connectorId: z.string(),
    allEnabled: z.boolean().optional(),
    enabledActions: z.array(z.string()).optional(),
  })).optional().default([]),
}).passthrough();

export const updateTemplateSchema = createTemplateSchema.partial();

export const skillWriteSchema = z.object({
  content: z.string(),
});

export const openSchema = z.object({
  path: z.string().min(1, 'path is required'),
  action: z.enum(['open', 'folder']).optional(),
});

export const fileTrackSchema = z.object({
  path: z.string().min(1, 'path is required'),
});

export const connectorSyncSchema = z.object({
  tools: z.array(z.string()).min(1, 'tools array is required'),
});
