import type OpenAI from 'openai'
import type { Message } from '@/db/types'
import {
  getAssistantReasoningParts,
  getAssistantTextParts,
  getAssistantToolUses,
  isMessageIncludedInContext,
} from './message-state'

export function getEffectiveConversationMessages(
  messages: Message[],
  compactedThroughMessageId: string | null,
): Message[] {
  const includedMessages = messages.filter(isMessageIncludedInContext)
  if (!compactedThroughMessageId) {
    return includedMessages
  }

  const boundaryIndex = includedMessages.findIndex(
    (message) => message.id === compactedThroughMessageId,
  )
  if (boundaryIndex === -1) {
    return includedMessages
  }

  return includedMessages.slice(boundaryIndex + 1)
}

export function convertToApiMessages(
  messages: Message[],
  includeReasoningContent: boolean,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  for (const message of messages) {
    if (!isMessageIncludedInContext(message)) continue

    switch (message.role) {
      case 'user':
        result.push({ role: 'user', content: message.content })
        break
      case 'assistant': {
        const includeAssistantContent = message.state === 'completed'
        const textContent = includeAssistantContent ? getAssistantTextParts(message).join('') : ''
        const reasoningContent = includeAssistantContent
          ? getAssistantReasoningParts(message).join('')
          : ''
        const toolUses = getAssistantToolUses(message).filter(
          (toolUse) => toolUse.status !== 'cancelled' && toolUse.result !== null,
        )

        if (!textContent && toolUses.length === 0) {
          break
        }

        const assistantMessage: Record<string, unknown> = {
          role: 'assistant',
          content: textContent || null,
        }

        if (includeAssistantContent && includeReasoningContent && reasoningContent) {
          assistantMessage.reasoning_content = reasoningContent
        }

        if (toolUses.length > 0) {
          assistantMessage.tool_calls = toolUses.map((toolUse) => ({
            id: toolUse.toolCallId,
            type: 'function' as const,
            function: {
              name: toolUse.toolName,
              arguments: toolUse.rawArguments,
            },
          }))
        }

        result.push(
          assistantMessage as unknown as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
        )

        for (const toolUse of toolUses) {
          result.push({
            role: 'tool',
            content: toolUse.result!,
            tool_call_id: toolUse.toolCallId,
          })
        }
        break
      }
      case 'status':
        break
    }
  }

  return result
}
