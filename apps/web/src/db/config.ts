import { getDB } from './index'
import type { AppConfig } from './types'
import { createDefaultConfig } from './types'

export async function getConfig(): Promise<AppConfig> {
  const db = await getDB()
  const config = await db.get('config', 'app-config')
  return config ?? createDefaultConfig()
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const db = await getDB()
  await db.put('config', { ...config, id: 'app-config' })
}
