import type { ModelConfig } from '@/db/types'

export function supportsReasoningContent(model: Pick<ModelConfig, 'provider' | 'apiBase' | 'model'>): boolean {
  const provider = model.provider.toLowerCase()
  const apiBase = model.apiBase.toLowerCase()
  const modelName = model.model.toLowerCase()

  return (
    provider.includes('deepseek')
    || apiBase.includes('deepseek')
    || modelName.includes('reasoner')
    || modelName.includes('deepseek-r1')
    || /\br1\b/.test(modelName)
  )
}
