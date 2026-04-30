import { getDB } from './index'
import type { OperationRecord } from './types'

const MAX_OPERATIONS = 50

export async function getOperationHistoryByNovelId(novelId: string): Promise<OperationRecord[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('operationHistory', 'novelId', novelId)
  return all.toSorted((a, b) => b.timestamp - a.timestamp)
}

export async function pushOperation(record: OperationRecord): Promise<void> {
  const db = await getDB()
  await db.add('operationHistory', record)
  await trimOperations(record.novelId)
}

export async function clearOperations(novelId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('operationHistory', 'readwrite')
  const keys = await tx.store.index('novelId').getAllKeys(novelId)
  await Promise.all(keys.map((k) => tx.store.delete(k)))
  await tx.done
}

async function trimOperations(novelId: string): Promise<void> {
  const db = await getDB()
  const records = await db.getAllFromIndex('operationHistory', 'novelId', novelId)
  const sorted = records.toSorted((a, b) => a.timestamp - b.timestamp)
  if (sorted.length > MAX_OPERATIONS) {
    const toDelete = sorted.slice(0, sorted.length - MAX_OPERATIONS)
    const tx = db.transaction('operationHistory', 'readwrite')
    await Promise.all(toDelete.map((r) => tx.store.delete(r.id)))
    await tx.done
  }
}
