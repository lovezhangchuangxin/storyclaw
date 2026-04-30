import OpenAI from 'openai'

export interface ProviderInfo {
  apiBase: string
  models: string[]
}

export const KNOWN_PROVIDERS: Record<string, ProviderInfo> = {
  DeepSeek: {
    apiBase: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  Zhipu: {
    apiBase: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4-long', 'glm-4'],
  },
  MiniMax: {
    apiBase: 'https://api.minimax.chat/v1',
    models: ['MiniMax-Text-01', 'abab6.5s-chat'],
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
  'deepseek-chat': 4096,
  'deepseek-reasoner': 4096,
  'glm-4-plus': 4096,
  'glm-4-flash': 4096,
  'glm-4-air': 4096,
  'glm-4-long': 4096,
  'glm-4': 4096,
  'MiniMax-Text-01': 4096,
  'abab6.5s-chat': 4096,
}

export function getMaxTokensForModel(model: string): number | undefined {
  return MODEL_MAX_TOKENS[model]
}

export async function fetchModels(apiBase: string, apiKey: string): Promise<string[]> {
  const client = new OpenAI({
    baseURL: apiBase,
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const { data } = await client.models.list()
  return data
    .map((m) => m.id)
    .filter(Boolean)
    .sort()
}
