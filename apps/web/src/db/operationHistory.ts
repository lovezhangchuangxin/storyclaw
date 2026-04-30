import { getDB } from './index'
import type { OperationRecord } from './types'

const MAX_OPERATIONS = 50

export async function getOperationHistoryByNovelId(novelId: string): Promise<OperationRecord[]> {
  const db = await getDB()
  const all = await db.getAll('operationHistory')
  return all.filter((r) => r.novelId === novelId).toSorted((a, b) => b.timestamp - a.timestamp)
}

export async function pushOperation(record: OperationRecord): Promise<void> {
  const db = await getDB()
  await db.add('operationHistory', record)
  await trimOperations(record.novelId)
}

export async function clearOperations(novelId: string): Promise<void> {
  const db = await getDB()
  const records = await db.getAll('operationHistory')
  const tx = db.transaction('operationHistory', 'readwrite')
  await Promise.all(records.filter((r) => r.novelId === novelId).map((r) => tx.store.delete(r.id)))
  await tx.done
}

async function trimOperations(novelId: string): Promise<void> {
  const db = await getDB()
  const records = await db.getAll('operationHistory')
  const novelOps = records
    .filter((r) => r.novelId === novelId)
    .toSorted((a, b) => a.timestamp - b.timestamp)
  if (novelOps.length > MAX_OPERATIONS) {
    const toDelete = novelOps.slice(0, novelOps.length - MAX_OPERATIONS)
    const tx = db.transaction('operationHistory', 'readwrite')
    await Promise.all(toDelete.map((r) => tx.store.delete(r.id)))
    await tx.done
  }
}
