import { getDB } from './index'
import type { ReadingProgress } from './types'

export async function getReadingProgressByNovelId(
  novelId: string,
): Promise<ReadingProgress | undefined> {
  const db = await getDB()
  return db.get('readingProgress', novelId)
}

export async function saveReadingProgress(progress: ReadingProgress): Promise<void> {
  const db = await getDB()
  await db.put('readingProgress', progress)
}
