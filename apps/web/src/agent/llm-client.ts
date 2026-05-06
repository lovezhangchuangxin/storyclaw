import OpenAI from 'openai'
import type { ModelConfig } from '@/db/types'
import { i18n } from '@/i18n'
import { getAccessToken } from '@/lib/api-client'
import { isAbortError } from './utils'

const MAX_RETRIES = 3
const INITIAL_DELAY_MS = 1000
const MAX_DELAY_MS = 15000

function isRetryableError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    const status = error.status
    return status === 429 || (status !== undefined && status >= 500 && status < 600)
  }
  return false
}

async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function getRetryDelay(attempt: number): number {
  const base = INITIAL_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * base * 0.3
  return Math.min(base + jitter, MAX_DELAY_MS)
}

export interface LLMClientOptions {
  config: ModelConfig
  onToken?: (token: string) => void
  onToolCallStart?: (toolCallId: string, toolName: string, rawArguments: string) => void
  onToolStreamToken?: (toolCallId: string, toolName: string, token: string) => void
  onReasoningToken?: (token: string) => void
  signal?: AbortSignal
  backendUrl?: string
  modelId?: string
}

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export function createLLMClient(options: LLMClientOptions) {
  const {
    config,
    onToken,
    onToolCallStart,
    onToolStreamToken,
    onReasoningToken,
    signal,
    backendUrl,
    modelId,
  } = options

  // Only backend-hosted models (admin-configured) may use proxy.
  // User proxy toggle is disabled to prevent backend from forwarding user content.
  const shouldProxy = !!config.isBackendModel && !!backendUrl

  let baseURL = shouldProxy ? `${backendUrl}/api/llm/v1` : config.apiBase
  // OpenAI SDK requires absolute URLs; resolve relative paths (e.g. "/storyclaw")
  if (!baseURL.startsWith('http')) {
    const origin = globalThis.location?.origin
    if (origin) baseURL = `${origin}${baseURL.startsWith('/') ? '' : '/'}${baseURL}`
  }

  const client = new OpenAI({
    baseURL,
    apiKey: (() => {
      if (shouldProxy) {
        const token = getAccessToken()
        if (!token) throw new Error(i18n.global.t('agent.needLogin'))
        return token
      }
      return config.apiKey
    })(),
    dangerouslyAllowBrowser: true,
    fetch: async (url, init) => {
      if (init?.headers) {
        const headers = new Headers(init.headers as HeadersInit)
        for (const key of headers.keys()) {
          if (key === 'user-agent' || key.startsWith('x-stainless-')) {
            headers.delete(key)
          }
        }
        return globalThis.fetch(url, { ...init, headers })
      }
      return globalThis.fetch(url, init)
    },
  })

  return {
    async chat(
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    ) {
      const params = {
        model: config.model,
        messages,
        tools,
        max_tokens: config.maxOutputTokens,
        temperature: 0.8,
        stream: true,
        stream_options: { include_usage: true },
        ...(modelId ? { model_id: modelId } : {}),
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming

      // Retry on rate limits (429) and server errors (5xx)
      let stream!: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          stream = await client.chat.completions.create(params, { signal })
          break
        } catch (error) {
          if (signal?.aborted || isAbortError(error)) throw error
          if (attempt < MAX_RETRIES && isRetryableError(error)) {
            const delay = getRetryDelay(attempt)
            console.warn(
              `[LLM] ${attempt + 1}/${MAX_RETRIES} retry in ${Math.round(delay)}ms (status ${(error as { status?: number }).status})`,
            )
            await sleepWithAbort(delay, signal)
            continue
          }
          throw error
        }
      }

      let content = ''
      let reasoningContent = ''
      const toolCalls: Map<
        number,
        {
          id: string
          name: string
          arguments: string
          started: boolean
        }
      > = new Map()
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
        .toSorted(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
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
