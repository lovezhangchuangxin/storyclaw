import { getDB } from './index'
import type { Outline } from './types'

export async function getOutlineByNovelId(novelId: string): Promise<Outline | undefined> {
  const db = await getDB()
  return db.get('outlines', novelId)
}

export async function saveOutline(outline: Outline): Promise<void> {
  const db = await getDB()
  await db.put('outlines', outline)
}

export async function deleteOutline(novelId: string): Promise<void> {
  const db = await getDB()
  await db.delete('outlines', novelId)
}
