import { getDB } from './index'
import type { AppConfig } from './types'
import { DEFAULT_CONFIG } from './types'

export async function getConfig(): Promise<AppConfig> {
  const db = await getDB()
  const config = await db.get('config', 'app-config')
  return config ?? DEFAULT_CONFIG
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const db = await getDB()
  await db.put('config', { ...config, id: 'app-config' })
}
