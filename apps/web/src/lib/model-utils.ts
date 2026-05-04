import type { ModelConfig } from '@/db/types'

export function modelLabel(m: ModelConfig): string {
  // Use custom name if available (backend models), otherwise fallback to provider — model
  return m.name || `${m.provider} — ${m.model}`
}
