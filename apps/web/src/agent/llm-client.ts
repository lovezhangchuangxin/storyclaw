import OpenAI from 'openai'
import type { ModelConfig } from '@/db/types'

export interface LLMClientOptions {
  config: ModelConfig
  onToken?: (token: string) => void
  onToolArgToken?: (toolName: string, token: string) => void
  signal?: AbortSignal
}

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export function createLLMClient(options: LLMClientOptions) {
  const { config, onToken, onToolArgToken, signal } = options

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
      // thinking models (DeepSeek R1, etc.) emit reasoning_content in stream deltas.
      // The API requires it back verbatim on the assistant message in subsequent requests.
      let reasoningContent = ''
      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()
      let usage: LLMUsage | undefined
      let finishReason: string = 'stop'

      for await (const chunk of stream) {
        if (signal?.aborted) break

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

        // reasoning_content is not in OpenAI SDK's Delta type — it's a
        // provider-specific extension used by DeepSeek R1 and o1 models.
        if ((delta as any)?.reasoning_content) {
          reasoningContent += (delta as any).reasoning_content
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index
            if (!toolCalls.has(idx)) {
              if (!tc.id) continue
              toolCalls.set(idx, { id: tc.id, name: tc.function?.name ?? '', arguments: '' })
            }
            const entry = toolCalls.get(idx)!
            if (tc.function?.name) entry.name = tc.function.name
            if (tc.function?.arguments) {
              entry.arguments += tc.function.arguments
              if (entry.name && onToolArgToken) {
                onToolArgToken(entry.name, tc.function.arguments)
              }
            }
          }
        }
      }

      const mappedToolCalls = [...toolCalls.values()].map((tc) => ({
        id: tc.id,
        function: { name: tc.name, arguments: tc.arguments },
      }))

      return {
        content,
        toolCalls: mappedToolCalls,
        usage,
        finishReason,
        // pass reasoning content through so callers can relay it back to the API
        reasoningContent: reasoningContent || undefined,
      }
    },
  }
}

export type LLMResponse = Awaited<ReturnType<ReturnType<typeof createLLMClient>['chat']>>
