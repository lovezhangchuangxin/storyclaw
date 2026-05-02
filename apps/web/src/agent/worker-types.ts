export interface WorkerRequest {
  type: 'start_turn'
  payload: {
    message: string
    novelId: string
    modelConfigId?: string
    correlationId: string
  }
}

export interface CompactContextRequest {
  type: 'compact_context'
  payload: {
    novelId: string
    correlationId: string
    reason: 'auto' | 'manual'
    instructions?: string
  }
}

export type WorkerMessage = WorkerRequest | CompactContextRequest

export interface CompactContextResponse {
  type: 'compact'
  payload: {
    stage: 'queued' | 'started' | 'done' | 'failed'
    snapshotId?: string
    compactedThroughMessageId?: string | null
    estimatedInputTokensBefore?: number
    estimatedInputTokensAfter?: number
    error?: string
  }
  correlationId: string
}

export interface WorkerResponse {
  type:
    | 'token'
    | 'reasoning_token'
    | 'tool_stream_token'
    | 'tool_call'
    | 'tool_result'
    | 'status'
    | 'turn_done'
    | 'turn_cancelled'
    | 'error'
    | 'compact'
  payload?: Record<string, unknown>
  correlationId: string
}

export function postToMain(response: WorkerResponse) {
  self.postMessage(response, self.location.origin)
}
