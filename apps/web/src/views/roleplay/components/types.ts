import type { StatusMessage } from '@/db/types'

export interface RenderMessageItem {
  role: 'narrator' | 'system'
  content: string
  emote?: string
}

export interface ChoiceItem {
  id: string
  text: string
  description?: string
}

export type ToolStatus = 'pending' | 'completed' | 'cancelled' | 'error'

export type RoleplayDisplayItem =
  | { type: 'user'; id: string; content: string; timestamp: number }
  | { type: 'status'; id: string; content: string; timestamp: number; kind: StatusMessage['kind'] }
  | { type: 'reasoning'; id: string; content: string; timestamp: number }
  | { type: 'assistant'; id: string; content: string; timestamp: number; isStreaming: boolean }
  | {
      type: 'roleplay_messages'
      id: string
      messages: RenderMessageItem[]
      timestamp: number
      status: ToolStatus
    }
  | {
      type: 'roleplay_choice'
      id: string
      toolCallId: string
      prompt: string
      choices: ChoiceItem[]
      allowFreeText: boolean
      timestamp: number
      status: ToolStatus
    }
  | {
      type: 'tool_card'
      id: string
      toolName: string
      rawArguments: string
      parsedArguments: Record<string, unknown> | null
      result: string | null
      timestamp: number
      status: ToolStatus
    }

export interface RoleplayTurnGroup {
  turnId: string
  timestamp: number
  items: RoleplayDisplayItem[]
}
