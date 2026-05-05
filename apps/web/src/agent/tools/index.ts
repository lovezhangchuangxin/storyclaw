import type OpenAI from 'openai'
import { z } from 'zod'
import { i18n } from '@/i18n'
import { getToolRegistry } from './registry'
import type { ToolContext } from './types'

export { getToolRegistry, clearToolRegistryCache as clearRegistryCache } from './registry'
export type { ToolContext } from './types'
export { getToolDisplayConfig, getField } from './display-config'

/** Reset all caches. Call when tool definitions may have changed (e.g. hot-reload). */
export function clearToolRegistryCache(): void {
  _displayMap = null
}

let _displayMap: Map<string, { displayName: string; icon: string }> | null = null

/** Build the display-info cache once. Display info is static (same across all contexts). */
function ensureDisplayMap(): Map<string, { displayName: string; icon: string }> {
  if (!_displayMap) {
    const { t } = i18n.global
    const tools = getToolRegistry({ novelId: '' })
    _displayMap = new Map(
      [...tools.values()].map((tool) => [
        tool.name,
        { displayName: t(tool.displayName), icon: tool.icon },
      ]),
    )
  }
  return _displayMap
}

export function getToolDisplayInfo(name: string): { displayName: string; icon: string } {
  return ensureDisplayMap().get(name) ?? { displayName: name, icon: '🔧' }
}

export async function executeToolCall(
  name: string,
  args: string,
  context: ToolContext,
): Promise<string> {
  const toolMap = getToolRegistry(context)
  const tool = toolMap.get(name)

  if (!tool) {
    return JSON.stringify({ error: `Unknown tool: ${name}` })
  }

  try {
    const raw = JSON.parse(args)
    const validated = tool.validationSchema.parse(raw) as Record<string, unknown>
    const result = await tool.execute(validated)
    return JSON.stringify(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return JSON.stringify({
        error: `Parameter validation failed: ${String(err)}`,
      })
    }
    return JSON.stringify({ error: String(err) })
  }
}

export function getToolDefinitions(
  context: ToolContext,
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const { t } = i18n.global
  return [...getToolRegistry(context).values()].map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: t(tool.description),
      parameters: tool.parameters,
    },
  }))
}
