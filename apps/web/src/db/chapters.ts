import { getDB } from './index'
import type { Chapter } from './types'

export async function getChaptersByNovelId(novelId: string): Promise<Chapter[]> {
  const db = await getDB()
  return db.getAllFromIndex('chapters', 'novelId', novelId)
}

export async function getChapterCountByNovelId(novelId: string): Promise<number> {
  const db = await getDB()
  return db.countFromIndex('chapters', 'novelId', novelId)
}

export async function getChapterByIndex(
  novelId: string,
  index: number,
): Promise<Chapter | undefined> {
  const db = await getDB()
  return db.get('chapters', [novelId, index])
}

export async function saveChapter(chapter: Chapter): Promise<void> {
  const db = await getDB()
  await db.put('chapters', chapter)
}

export async function deleteChapter(novelId: string, index: number): Promise<void> {
  const db = await getDB()
  await db.delete('chapters', [novelId, index])
}
