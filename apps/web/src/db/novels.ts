import { getDB } from './index'
import type { Novel } from './types'

export async function getAllNovels(): Promise<Novel[]> {
  const db = await getDB()
  return db.getAll('novels')
}

export async function getNovelById(id: string): Promise<Novel | undefined> {
  const db = await getDB()
  return db.get('novels', id)
}

export async function createNovel(novel: Novel): Promise<string> {
  const db = await getDB()
  await db.add('novels', novel)
  return novel.id
}

export async function updateNovel(novel: Novel): Promise<void> {
  const db = await getDB()
  await db.put('novels', novel)
}

export async function deleteNovel(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    [
      'novels',
      'outlines',
      'characters',
      'chapters',
      'worldBuilding',
      'conversations',
      'contextSnapshots',
      'readingProgress',
      'operationHistory',
    ],
    'readwrite',
  )

  const charKeys = await tx.objectStore('characters').index('novelId').getAllKeys(id)
  const chapterKeys = await tx.objectStore('chapters').index('novelId').getAllKeys(id)
  const snapshotKeys = await tx.objectStore('contextSnapshots').index('novelId').getAllKeys(id)
  const opRecords = await tx.objectStore('operationHistory').getAll()

  await Promise.all([
    tx.objectStore('novels').delete(id),
    tx.objectStore('outlines').delete(id),
    tx.objectStore('worldBuilding').delete(id),
    tx.objectStore('conversations').delete(id),
    ...snapshotKeys.map((key) => tx.objectStore('contextSnapshots').delete(key as string)),
    tx.objectStore('readingProgress').delete(id),
    ...charKeys.map((k) => tx.objectStore('characters').delete(k as [string, string])),
    ...chapterKeys.map((k) => tx.objectStore('chapters').delete(k as [string, number])),
    ...opRecords
      .filter((r) => r.novelId === id)
      .map((r) => tx.objectStore('operationHistory').delete(r.id)),
  ])

  await tx.done
}
