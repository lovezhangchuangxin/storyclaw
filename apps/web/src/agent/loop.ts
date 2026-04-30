import { createLLMClient } from './llm-client'
import { buildContext } from './context'
import { executeToolCall } from './tools'
import type { ToolContext } from './tools/types'
import type { Message } from '@/db/types'
import { getConfig } from '@/db/config'
import { saveConversation } from '@/db/conversations'

export interface AgentLoopOptions {
  novelId: string
  userMessage: string
  modelConfigId?: string
  onToken?: (token: string) => void
  onToolCall?: (name: string, args: string) => void
  onToolResult?: (name: string, result: string) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

const MAX_TOOL_ITERATIONS = 15

export async function runAgentLoop(options: AgentLoopOptions): Promise<Message[]> {
  const { novelId, userMessage, onToken, onToolCall, onToolResult, onError, signal } = options

  const config = await getConfig()
  const modelId = options.modelConfigId ?? config.defaultModelId
  if (!modelId || !config.models.length) {
    onError?.('没有配置模型。请在设置中配置至少一个模型。')
    return []
  }

  const modelConfig = config.models.find((m) => m.id === modelId) ?? config.models[0]
  const client = createLLMClient({ config: modelConfig, onToken, signal })
  const toolContext: ToolContext = { novelId }

  const allMessages: Message[] = [
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    },
  ]

  let iterationCount = 0

  try {
    while (iterationCount < MAX_TOOL_ITERATIONS) {
      if (signal?.aborted) {
        allMessages.push({
          id: crypto.randomUUID(),
          role: 'system',
          content: '[用户取消了生成]',
          timestamp: Date.now(),
        })
        break
      }

      iterationCount++

      const ctx = await buildContext(novelId, userMessage)

      const response = await client.chat(ctx.messages, ctx.tools)

      const parsedToolCalls = response.toolCalls?.map((tc) => {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          args = { _parse_error: tc.function.arguments }
        }
        return { id: tc.id, name: tc.function.name, arguments: args }
      })

      allMessages.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        toolCalls: parsedToolCalls,
        timestamp: Date.now(),
      })

      if (response.toolCalls?.length) {
        for (const tc of response.toolCalls) {
          if (signal?.aborted) break

          onToolCall?.(tc.function.name, tc.function.arguments)

          const result = await executeToolCall(tc.function.name, tc.function.arguments, toolContext)

          onToolResult?.(tc.function.name, result)

          allMessages.push({
            id: crypto.randomUUID(),
            role: 'tool',
            content: result,
            toolCallId: tc.id,
            timestamp: Date.now(),
          })
        }
        continue
      }

      break
    }

    if (iterationCount >= MAX_TOOL_ITERATIONS) {
      allMessages.push({
        id: crypto.randomUUID(),
        role: 'system',
        content: '[已达到最大工具调用次数，已自动停止]',
        timestamp: Date.now(),
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onError?.(msg)
    allMessages.push({
      id: crypto.randomUUID(),
      role: 'system',
      content: `[发生错误: ${msg}]`,
      timestamp: Date.now(),
    })
  }

  try {
    await saveConversation({
      novelId,
      messages: [...allMessages],
      updatedAt: Date.now(),
    })
  } catch {
    // silently fail — conversation save is best-effort
  }

  return allMessages
}
