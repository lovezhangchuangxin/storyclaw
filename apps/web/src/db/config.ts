import { getDB } from './index'
import type { AppConfig, ModelConfig } from './types'
import { createDefaultConfig, createDefaultModelConfig } from './types'

function normalizeModelConfig(model: ModelConfig): ModelConfig {
  return createDefaultModelConfig({
    ...model,
    summaryModelId: model.summaryModelId ?? '',
  })
}

function migrateTheme(config: Record<string, unknown>): void {
  if (!config.appTheme && config.readingTheme) {
    const old = config.readingTheme as string
    config.appTheme = old === 'ink-night' ? 'dark' : 'light'
    delete config.readingTheme
  }
  if (config.appTheme === 'sepia') {
    config.appTheme = 'parchment'
  }
  if (config.readingSettings && typeof config.readingSettings === 'object') {
    const rs = config.readingSettings as Record<string, unknown>
    delete rs.textColor
    delete rs.backgroundColor
  }
}

function normalizeConfig(config: AppConfig): AppConfig {
  const raw = config as unknown as Record<string, unknown>
  migrateTheme(raw)
  return {
    ...createDefaultConfig(),
    ...raw,
    models: (config.models ?? []).map((model) => normalizeModelConfig(model)),
    backgroundSettings: {
      ...createDefaultConfig().backgroundSettings,
      ...(raw.backgroundSettings as Record<string, unknown> | undefined),
    },
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
