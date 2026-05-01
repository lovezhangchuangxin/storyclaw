import type OpenAI from 'openai'
import { z } from 'zod'
import { getToolRegistry } from './registry'
import type { ToolContext } from './types'

export { getToolRegistry } from './registry'
export type { ToolContext } from './types'

let _displayMap: Map<string, { displayName: string; icon: string }> | null = null

function ensureDisplayMap(): Map<string, { displayName: string; icon: string }> {
  if (!_displayMap) {
    const tools = getToolRegistry({ novelId: '' })
    _displayMap = new Map(
      [...tools.values()].map((t) => [t.name, { displayName: t.displayName, icon: t.icon }]),
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
        error: `参数验证失败: ${String(err)}`,
      })
    }
    return JSON.stringify({ error: String(err) })
  }
}

export function getToolDefinitions(
  context: ToolContext,
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [...getToolRegistry(context).values()].map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}
