import type OpenAI from 'openai'
import { getAllTools } from './registry'
import type { ToolContext } from './types'

export { getAllTools } from './registry'
export type { ToolContext } from './types'

export async function executeToolCall(
  name: string,
  args: string,
  context: ToolContext,
): Promise<string> {
  const tools = getAllTools(context)
  const tool = tools.find((t) => t.name === name)

  if (!tool) {
    return JSON.stringify({ error: `Unknown tool: ${name}` })
  }

  try {
    const parsed = JSON.parse(args)
    const result = await tool.execute(parsed)
    return JSON.stringify(result)
  } catch (err) {
    return JSON.stringify({ error: String(err) })
  }
}

export function getToolDefinitions(
  context: ToolContext,
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return getAllTools(context).map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}
