import type OpenAI from 'openai'
import { createLLMClient } from './llm-client'
import { buildContext } from './context'
import { executeToolCall } from './tools'
import type { ToolContext } from './tools/types'
import type { Message } from '@/db/types'
import { getConfig } from '@/db/config'
import { getConversationByNovelId, saveConversation } from '@/db/conversations'

export interface AgentLoopOptions {
  novelId: string
  userMessage: string
  modelConfigId?: string
  onToken?: (token: string) => void
  onToolCall?: (toolCallId: string, name: string, args: Record<string, unknown>) => void
  onToolResult?: (toolCallId: string, name: string, result: string) => void
  onToolStreamToken?: (toolCallId: string, toolName: string, token: string) => void
  onReasoningToken?: (token: string) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

const MAX_TOOL_ITERATIONS = 15

function repairDanglingToolCalls(messages: Message[]): void {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role !== 'tool_call') continue

    const tcId = msg.toolCallId!
    const hasResult = messages.some(
      (m, j) => j > i && m.role === 'tool' && m.toolCallId === tcId,
    )
    if (!hasResult) {
      messages.splice(i + 1, 0, {
        id: crypto.randomUUID(),
        role: 'tool',
        content: JSON.stringify({ error: '操作被用户中断' }),
        toolCallId: tcId,
        timestamp: Date.now(),
      })
    }
  }
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<Message[]> {
  const {
    novelId,
    userMessage,
    onToken,
    onToolCall,
    onToolResult,
    onToolStreamToken,
    onReasoningToken,
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
    onReasoningToken,
    onToolStreamToken,
    signal,
  })
  const toolContext: ToolContext = { novelId }

  const existingConv = await getConversationByNovelId(novelId)
  const historyMessages = existingConv?.messages ?? []
  const allMessages: Message[] = [
    ...historyMessages,
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    },
  ]
  const newStartIndex = historyMessages.length

  const ctx = await buildContext(novelId, userMessage, existingConv)
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

      const tokensUsed = response.usage

      const openaiAssistantMsg: Record<string, unknown> = {
        role: 'assistant',
        content: response.content || null,
      }
      if (response.reasoningContent) {
        openaiAssistantMsg.reasoning_content = response.reasoningContent
      }
      if (response.toolCalls.length > 0) {
        openaiAssistantMsg.tool_calls = response.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }))
      }
      localMessages.push(
        openaiAssistantMsg as unknown as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
      )

      if (response.reasoningContent) {
        allMessages.push({
          id: crypto.randomUUID(),
          role: 'reasoning',
          content: response.reasoningContent,
          reasoningContent: response.reasoningContent,
          timestamp: Date.now(),
        })
      }

      const parsedToolCalls = response.toolCalls.map((tc) => {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          args = { _parse_error: tc.function.arguments }
        }
        return { id: tc.id, name: tc.function.name, arguments: args }
      })

      if (response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          if (signal?.aborted) break

          const parsedArgs = parsedToolCalls.find((p) => p.id === tc.id)?.arguments ?? {}
          onToolCall?.(tc.id, tc.function.name, parsedArgs)

          allMessages.push({
            id: crypto.randomUUID(),
            role: 'tool_call',
            content: '',
            toolCallId: tc.id,
            toolName: tc.function.name,
            arguments: parsedArgs,
            timestamp: Date.now(),
          })

          const result = await executeToolCall(tc.function.name, tc.function.arguments, toolContext)

          onToolResult?.(tc.id, tc.function.name, result)

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

        if (response.content && !signal?.aborted) {
          allMessages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response.content,
            timestamp: Date.now(),
            promptTokens: tokensUsed?.promptTokens,
            completionTokens: tokensUsed?.completionTokens,
          })
        }

        continue
      }

      if (response.content) {
        allMessages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
          promptTokens: tokensUsed?.promptTokens,
          completionTokens: tokensUsed?.completionTokens,
        })
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

  repairDanglingToolCalls(allMessages)

  try {
    await saveConversation({
      novelId,
      messages: [...allMessages],
      updatedAt: Date.now(),
    })
  } catch {
    // silently fail — conversation save is best-effort
  }

  return allMessages.slice(newStartIndex)
}
