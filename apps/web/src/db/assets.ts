import { getDB } from './index'
import type { BackgroundImage } from './types'

export async function listBackgroundImages(): Promise<BackgroundImage[]> {
  const db = await getDB()
  const all = await db.getAll('assets')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getBackgroundImage(id: string): Promise<BackgroundImage | undefined> {
  const db = await getDB()
  return db.get('assets', id)
}

export async function saveBackgroundImage(img: BackgroundImage): Promise<void> {
  const db = await getDB()
  await db.put('assets', img)
}

export async function deleteBackgroundImage(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('assets', id)
}
