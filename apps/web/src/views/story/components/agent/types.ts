import type { StatusMessage } from '@/db/types'

export type DisplayItem =
  | {
      type: 'user'
      id: string
      content: string
      timestamp: number
    }
  | {
      type: 'status'
      id: string
      content: string
      timestamp: number
      kind: StatusMessage['kind']
    }
  | {
      type: 'reasoning'
      id: string
      content: string
      timestamp: number
    }
  | {
      type: 'assistant'
      id: string
      content: string
      timestamp: number
      isStreaming: boolean
    }
  | {
      type: 'tool_card'
      id: string
      toolName: string
      rawArguments: string
      parsedArguments: Record<string, unknown> | null
      result: string | null
      timestamp: number
      status: 'pending' | 'completed' | 'cancelled' | 'error'
    }

export interface TurnGroup {
  turnId: string
  timestamp: number
  items: DisplayItem[]
}
