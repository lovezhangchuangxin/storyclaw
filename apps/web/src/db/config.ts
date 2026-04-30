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
  // JSON roundtrip strips Vue reactive proxies, which would otherwise
  // cause structuredClone to throw DataCloneError (Proxies are not cloneable)
  const plain = JSON.parse(JSON.stringify(config)) as AppConfig
  await db.put('config', { ...plain, id: 'app-config' })
}
