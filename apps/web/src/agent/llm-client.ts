import OpenAI from 'openai'
import type { ModelConfig } from '@/db/types'

export interface LLMClientOptions {
  config: ModelConfig
  onToken?: (token: string) => void
  signal?: AbortSignal
}

export function createLLMClient(options: LLMClientOptions) {
  const { config, onToken, signal } = options

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
          temperature: config.temperature,
          top_p: config.topP,
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal },
      )

      let content = ''
      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

      for await (const chunk of stream) {
        if (signal?.aborted) break

        const delta = chunk.choices[0]?.delta

        if (delta?.content) {
          content += delta.content
          onToken?.(delta.content)
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index
            if (!toolCalls.has(idx)) {
              if (!tc.id) continue
              toolCalls.set(idx, { id: tc.id, name: tc.function?.name ?? '', arguments: '' })
            }
            if (tc.function?.arguments) {
              toolCalls.get(idx)!.arguments += tc.function.arguments
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
        usage: undefined,
        finishReason: 'stop' as const,
      }
    },
  }
}

export type LLMResponse = Awaited<ReturnType<ReturnType<typeof createLLMClient>['chat']>>
