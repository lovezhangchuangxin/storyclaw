import OpenAI from 'openai'
import type { ModelConfig } from '@/db/types'

export interface LLMClientOptions {
  config: ModelConfig
  onToken?: (token: string) => void
  onToolCallStart?: (toolCallId: string, toolName: string, rawArguments: string) => void
  onToolStreamToken?: (toolCallId: string, toolName: string, token: string) => void
  onReasoningToken?: (token: string) => void
  signal?: AbortSignal
}

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error && error.name === 'AbortError'
  )
}

export function createLLMClient(options: LLMClientOptions) {
  const { config, onToken, onToolCallStart, onToolStreamToken, onReasoningToken, signal } = options

  const client = new OpenAI({
    baseURL: config.apiBase,
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  })

  return {
    async chat(
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    ) {
      const stream = await client.chat.completions.create(
        {
          model: config.model,
          messages,
          tools,
          max_tokens: config.maxTokens,
          temperature: 0.8,
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal },
      )

      let content = ''
      let reasoningContent = ''
      const toolCalls: Map<number, {
        id: string
        name: string
        arguments: string
        started: boolean
      }> = new Map()
      let usage: LLMUsage | undefined
      let finishReason = 'stop'
      let aborted = false

      try {
        for await (const chunk of stream) {
          if (signal?.aborted) {
            aborted = true
            break
          }

          if (chunk.usage) {
            usage = {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            }
          }

          const choice = chunk.choices?.[0]
          if (choice?.finish_reason) {
            finishReason = choice.finish_reason
          }

          const delta = choice?.delta

          if (delta?.content) {
            content += delta.content
            onToken?.(delta.content)
          }

          if ((delta as any)?.reasoning_content) {
            reasoningContent += (delta as any).reasoning_content
            onReasoningToken?.((delta as any).reasoning_content)
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index
              if (!toolCalls.has(idx)) {
                if (!tc.id) continue
                toolCalls.set(idx, {
                  id: tc.id,
                  name: tc.function?.name ?? '',
                  arguments: '',
                  started: false,
                })
              }
              const entry = toolCalls.get(idx)!
              if (tc.function?.name) entry.name = tc.function.name
              if (tc.function?.arguments) {
                entry.arguments += tc.function.arguments
                if (entry.started && entry.name && onToolStreamToken) {
                  onToolStreamToken(entry.id, entry.name, tc.function.arguments)
                }
              }
              if (!entry.started && entry.id && entry.name) {
                entry.started = true
                onToolCallStart?.(entry.id, entry.name, entry.arguments)
              }
            }
          }
        }
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) {
          aborted = true
        } else {
          throw error
        }
      }

      const mappedToolCalls = [...toolCalls.entries()]
        .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
        .map(([, tc]) => ({
          id: tc.id,
          function: { name: tc.name, arguments: tc.arguments },
        }))

      return {
        content,
        toolCalls: mappedToolCalls,
        usage,
        finishReason,
        aborted,
        reasoningContent: reasoningContent || undefined,
      }
    },
  }
}

export type LLMResponse = Awaited<ReturnType<ReturnType<typeof createLLMClient>['chat']>>
