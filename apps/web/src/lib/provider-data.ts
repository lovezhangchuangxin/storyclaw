import OpenAI from 'openai'

export interface ProviderInfo {
  apiBase: string
}

export const KNOWN_PROVIDERS: Record<string, ProviderInfo> = {
  DeepSeek: {
    apiBase: 'https://api.deepseek.com',
  },
  Zhipu: {
    apiBase: 'https://open.bigmodel.cn/api/paas/v4',
  },
  MiniMax: {
    apiBase: 'https://api.minimax.chat/v1',
  },
}

export const PROVIDER_NAMES = Object.keys(KNOWN_PROVIDERS)

export function getApiBaseForProvider(provider: string): string {
  return KNOWN_PROVIDERS[provider]?.apiBase ?? ''
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
