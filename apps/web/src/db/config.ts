import { getDB } from './index'
import type { AppConfig, ModelConfig } from './types'
import { createDefaultConfig, createDefaultModelConfig } from './types'

function normalizeModelConfig(model: ModelConfig): ModelConfig {
  return createDefaultModelConfig({
    ...model,
    summaryModelId: model.summaryModelId ?? '',
  })
}

function normalizeConfig(config: AppConfig): AppConfig {
  return {
    ...createDefaultConfig(),
    ...config,
    models: (config.models ?? []).map((model) => normalizeModelConfig(model)),
  }
}

export async function getConfig(): Promise<AppConfig> {
  const db = await getDB()
  const config = await db.get('config', 'app-config')
  return config ? normalizeConfig(config) : createDefaultConfig()
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const db = await getDB()
  // JSON roundtrip strips Vue reactive proxies, which would otherwise
  // cause structuredClone to throw DataCloneError (Proxies are not cloneable)
  const plain = JSON.parse(JSON.stringify(normalizeConfig(config))) as AppConfig
  await db.put('config', { ...plain, id: 'app-config' })
}
