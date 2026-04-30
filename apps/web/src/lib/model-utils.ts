import type { ModelConfig } from '@/db/types'

export function modelLabel(m: ModelConfig): string {
  return `${m.provider} — ${m.model}`
}
