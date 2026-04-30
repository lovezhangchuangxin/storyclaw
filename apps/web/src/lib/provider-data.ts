export interface ProviderInfo {
  apiBase: string
  models: string[]
}

export const KNOWN_PROVIDERS: Record<string, ProviderInfo> = {
  OpenAI: {
    apiBase: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  },
  DeepSeek: {
    apiBase: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
}

export const PROVIDER_NAMES = Object.keys(KNOWN_PROVIDERS)

export function getModelsForProvider(provider: string): string[] {
  return KNOWN_PROVIDERS[provider]?.models ?? []
}

export function getApiBaseForProvider(provider: string): string {
  return KNOWN_PROVIDERS[provider]?.apiBase ?? ''
}

export const MODEL_MAX_TOKENS: Record<string, number> = {
  'gpt-4o': 4096,
  'gpt-4o-mini': 4096,
  'gpt-4-turbo': 4096,
  'gpt-4': 4096,
  'gpt-3.5-turbo': 4096,
  'deepseek-chat': 4096,
  'deepseek-reasoner': 4096,
}

export function getMaxTokensForModel(model: string): number | undefined {
  return MODEL_MAX_TOKENS[model]
}
