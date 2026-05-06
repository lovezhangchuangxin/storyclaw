import { z } from 'zod'

export interface ToolContext {
  novelId: string
}

export interface ToolDefinition {
  name: string
  displayName: string
  icon: string
  description: string
  parameters: Record<string, unknown>
  validationSchema: z.ZodTypeAny
  execute(args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>
}
