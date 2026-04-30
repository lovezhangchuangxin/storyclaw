import { getDB } from './index'
import type { WorldBuilding } from './types'

export async function getWorldBuildingByNovelId(
  novelId: string,
): Promise<WorldBuilding | undefined> {
  const db = await getDB()
  return db.get('worldBuilding', novelId)
}

export async function saveWorldBuilding(worldBuilding: WorldBuilding): Promise<void> {
  const db = await getDB()
  await db.put('worldBuilding', worldBuilding)
}

export async function deleteWorldBuilding(novelId: string): Promise<void> {
  const db = await getDB()
  await db.delete('worldBuilding', novelId)
}
