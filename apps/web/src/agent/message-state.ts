import type {
  AssistantMessage,
  AssistantPart,
  AssistantToolUsePart,
  Message,
  StatusMessage,
  UserMessage,
} from '@/db/types'
import { uuid } from '@/lib/utils'

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = cloneValue(nestedValue)
    }
    return result as T
  }

  return value
}

export function createUserMessage(content: string): UserMessage {
  return {
    id: uuid(),
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

export function createStatusMessage(kind: StatusMessage['kind'], content: string): StatusMessage {
  return {
    id: uuid(),
    role: 'status',
    kind,
    content,
    timestamp: Date.now(),
  }
}

export function createAssistantMessage(): AssistantMessage {
  return {
    id: uuid(),
    role: 'assistant',
    parts: [],
    state: 'completed',
    timestamp: Date.now(),
  }
}

export function parseToolArguments(rawArguments: string): Record<string, unknown> | null {
  if (!rawArguments.trim()) return null
  try {
    const parsed = JSON.parse(rawArguments)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return { value: parsed }
  } catch {
    return null
  }
}

function getLastPart<T extends AssistantPart['type']>(
  message: AssistantMessage,
  type: T,
): Extract<AssistantPart, { type: T }> | null {
  const last = message.parts.at(-1)
  if (!last || last.type !== type) return null
  return last as Extract<AssistantPart, { type: T }>
}

export function appendAssistantText(message: AssistantMessage, text: string): void {
  if (!text) return
  const last = getLastPart(message, 'text')
  if (last) {
    last.text += text
    return
  }
  message.parts.push({ type: 'text', text })
}

export function appendAssistantReasoning(message: AssistantMessage, text: string): void {
  if (!text) return
  const last = getLastPart(message, 'reasoning')
  if (last) {
    last.text += text
    return
  }
  message.parts.push({ type: 'reasoning', text })
}

export function startAssistantToolUse(
  message: AssistantMessage,
  toolCallId: string,
  toolName: string,
  rawArguments = '',
): AssistantToolUsePart {
  const existing = findToolUsePart(message, toolCallId)
  if (existing) {
    if (toolName) existing.toolName = toolName
    if (rawArguments && rawArguments !== existing.rawArguments) {
      existing.rawArguments = rawArguments
      existing.arguments = parseToolArguments(existing.rawArguments)
    }
    return existing
  }

  const part: AssistantToolUsePart = {
    type: 'tool_use',
    toolCallId,
    toolName,
    rawArguments,
    arguments: parseToolArguments(rawArguments),
    result: null,
    status: 'pending',
  }
  message.parts.push(part)
  return part
}

export function findToolUsePart(
  message: AssistantMessage,
  toolCallId: string,
): AssistantToolUsePart | null {
  return (
    message.parts.find(
      (part): part is AssistantToolUsePart =>
        part.type === 'tool_use' && part.toolCallId === toolCallId,
    ) ?? null
  )
}

export function completeAssistantToolUse(
  message: AssistantMessage,
  toolCallId: string,
  result: string,
  status: AssistantToolUsePart['status'],
): AssistantToolUsePart | null {
  const part = findToolUsePart(message, toolCallId)
  if (!part) return null
  part.result = result
  part.status = status
  return part
}

export function cancelPendingToolUses(message: AssistantMessage): void {
  for (const part of message.parts) {
    if (part.type !== 'tool_use') continue
    if (part.status !== 'pending') continue
    part.status = 'cancelled'
  }
}

export function assistantHasRenderableContent(message: AssistantMessage): boolean {
  return message.parts.length > 0
}

export function getAssistantTextParts(message: AssistantMessage): string[] {
  return message.parts
    .filter((part): part is Extract<AssistantPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
}

export function getAssistantReasoningParts(message: AssistantMessage): string[] {
  return message.parts
    .filter(
      (part): part is Extract<AssistantPart, { type: 'reasoning' }> => part.type === 'reasoning',
    )
    .map((part) => part.text)
}

export function getAssistantToolUses(message: AssistantMessage): AssistantToolUsePart[] {
  return message.parts.filter((part): part is AssistantToolUsePart => part.type === 'tool_use')
}

export function isToolResultError(result: string): boolean {
  try {
    const parsed = JSON.parse(result)
    return !!parsed?.error
  } catch {
    return false
  }
}

export function isMessageIncludedInContext(message: Message): boolean {
  if (message.role === 'status') return false
  if (message.role === 'assistant') {
    return (
      message.state === 'completed' ||
      getAssistantToolUses(message).some(
        (toolUse) => toolUse.status !== 'cancelled' && toolUse.result !== null,
      )
    )
  }
  return true
}

export function cloneMessages(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.role === 'assistant') {
      return {
        ...message,
        parts: message.parts.map((part): AssistantPart => {
          if (part.type !== 'tool_use') {
            return { ...part }
          }
          return {
            ...part,
            arguments: cloneValue(part.arguments),
          }
        }),
      }
    }

    return { ...message }
  })
}
