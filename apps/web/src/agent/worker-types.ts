export interface WorkerRequest {
  type: 'start_turn'
  payload: {
    message: string
    novelId: string
    modelConfigId?: string
    correlationId: string
  }
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
