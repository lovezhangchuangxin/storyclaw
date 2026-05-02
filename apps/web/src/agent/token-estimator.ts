import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { AssistantMessage, Message } from '@/db/types'
import {
  getAssistantReasoningParts,
  getAssistantTextParts,
  getAssistantToolUses,
} from './message-state'

export function estimateTextTokens(text: string): number {
  const normalized = text.trim()
  if (!normalized) return 0

  const cjkChars = normalized.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  const latinWords = normalized.match(/[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/g)?.length ?? 0
  const punctuation = normalized.match(/[^\sA-Za-z0-9_\u4e00-\u9fff]/g)?.length ?? 0

  return Math.max(1, Math.ceil(cjkChars * 1.1 + latinWords * 1.25 + punctuation * 0.25))
}

export function estimateJsonTokens(value: unknown): number {
  try {
    return estimateTextTokens(JSON.stringify(value))
  } catch {
    return 0
  }
}

export function estimateMessageTokens(message: Message): number {
  const base = 4

  switch (message.role) {
    case 'user':
      return base + estimateTextTokens(message.content)
    case 'assistant': {
      const assistant = message as AssistantMessage
      const textTokens = getAssistantTextParts(assistant).reduce(
        (sum, part) => sum + estimateTextTokens(part),
        0,
      )
      const reasoningTokens = getAssistantReasoningParts(assistant).reduce(
        (sum, part) => sum + estimateTextTokens(part),
        0,
      )
      const toolTokens = getAssistantToolUses(assistant).reduce((sum, toolUse) => {
        return (
          sum
          + estimateTextTokens(toolUse.toolCallId)
          + estimateTextTokens(toolUse.toolName)
          + estimateTextTokens(toolUse.rawArguments)
          + estimateTextTokens(toolUse.result ?? '')
          + estimateJsonTokens(toolUse.arguments)
        )
      }, 0)

      return base + textTokens + reasoningTokens + toolTokens
    }
    case 'status':
      return 0
  }
}

export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0)
}

export function estimateToolDefinitionsTokens(
  tools: ChatCompletionTool[],
): number {
  return estimateJsonTokens(tools)
}

export function estimatePromptTokens(
  parts: Array<string | Message>,
  tools?: ChatCompletionTool[],
): number {
  const base = parts.reduce((sum, part) => {
    if (typeof part === 'string') {
      return sum + estimateTextTokens(part)
    }
    return sum + estimateMessageTokens(part)
  }, 0)

  return base + (tools ? estimateToolDefinitionsTokens(tools) : 0)
}

export function estimateWindowBudget(
  contextWindowTokens: number,
  outputReserveTokens: number,
): number {
  return Math.max(0, contextWindowTokens - outputReserveTokens)
}

export function calculateTriggerThreshold(
  contextWindowTokens: number,
  outputReserveTokens: number,
  ratio: number,
): number {
  return Math.floor(estimateWindowBudget(contextWindowTokens, outputReserveTokens) * ratio)
}

export function calculateTargetThreshold(
  contextWindowTokens: number,
  outputReserveTokens: number,
  ratio: number,
): number {
  return Math.floor(estimateWindowBudget(contextWindowTokens, outputReserveTokens) * ratio)
}
