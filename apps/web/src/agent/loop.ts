import type OpenAI from 'openai'
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
  onToolStreamToken?: (toolName: string, token: string) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

const MAX_TOOL_ITERATIONS = 15

export async function runAgentLoop(options: AgentLoopOptions): Promise<Message[]> {
  const {
    novelId,
    userMessage,
    onToken,
    onToolCall,
    onToolResult,
    onToolStreamToken,
    onError,
    signal,
  } = options

  const config = await getConfig()
  const modelId = options.modelConfigId ?? config.defaultModelId
  if (!modelId || !config.models.length) {
    onError?.('没有配置模型。请在设置中配置至少一个模型。')
    return []
  }

  const modelConfig = config.models.find((m) => m.id === modelId) ?? config.models[0]
  const client = createLLMClient({
    config: modelConfig,
    onToken,
    onToolArgToken: onToolStreamToken,
    signal,
  })
  const toolContext: ToolContext = { novelId }

  const allMessages: Message[] = [
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    },
  ]

  // Build context once — system messages + history + user message + tools
  const ctx = await buildContext(novelId, userMessage)
  // Maintain local OpenAI-format messages for multi-turn conversation within the loop
  const localMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...ctx.messages]

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

      const response = await client.chat(localMessages, ctx.tools)

      // Build OpenAI-format assistant message for local conversation
      const openaiAssistantMsg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: response.content || null,
      }
      if (response.toolCalls.length > 0) {
        openaiAssistantMsg.tool_calls = response.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }))
      }
      localMessages.push(openaiAssistantMsg)

      // Build storage-format Message
      const parsedToolCalls = response.toolCalls.map((tc) => {
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
        toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
        timestamp: Date.now(),
        promptTokens: response.usage?.promptTokens,
        completionTokens: response.usage?.completionTokens,
      })

      if (response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          if (signal?.aborted) break

          onToolCall?.(tc.function.name, tc.function.arguments)

          const result = await executeToolCall(tc.function.name, tc.function.arguments, toolContext)

          onToolResult?.(tc.function.name, result)

          // Add tool result to local messages so next iteration sees it
          localMessages.push({
            role: 'tool' as const,
            content: result,
            tool_call_id: tc.id,
          })

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
