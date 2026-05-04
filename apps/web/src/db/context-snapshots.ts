import { getDB } from './index'
import type { ContextSnapshot } from './types'

const MAX_SNAPSHOTS_PER_SCOPE = 3

export async function getContextSnapshotsByNovelId(novelId: string): Promise<ContextSnapshot[]> {
  const db = await getDB()
  return db.getAllFromIndex('contextSnapshots', 'novelId', novelId)
}

export async function getLatestContextSnapshot(
  novelId: string,
  scopeId = 'main',
): Promise<ContextSnapshot | undefined> {
  const db = await getDB()
  const range = IDBKeyRange.bound(
    [novelId, scopeId, 0],
    [novelId, scopeId, Number.MAX_SAFE_INTEGER],
  )
  const tx = db.transaction('contextSnapshots', 'readonly')
  const index = tx.objectStore('contextSnapshots').index('novelScopeRevision')
  const cursor = await index.openCursor(range, 'prev')
  return (cursor?.value ?? undefined) as ContextSnapshot | undefined
}

export async function getNextContextSnapshotRevision(
  novelId: string,
  scopeId = 'main',
): Promise<number> {
  const latest = await getLatestContextSnapshot(novelId, scopeId)
  return (latest?.revision ?? 0) + 1
}

export async function saveContextSnapshot(snapshot: ContextSnapshot): Promise<void> {
  const db = await getDB()
  await db.put('contextSnapshots', snapshot)
}

export async function pruneOldSnapshots(novelId: string, scopeId = 'main'): Promise<void> {
  const db = await getDB()
  const range = IDBKeyRange.bound(
    [novelId, scopeId, 0],
    [novelId, scopeId, Number.MAX_SAFE_INTEGER],
  )
  const all = await db.getAllFromIndex('contextSnapshots', 'novelScopeRevision', range)
  if (all.length <= MAX_SNAPSHOTS_PER_SCOPE) return

  const toDelete = all.slice(0, all.length - MAX_SNAPSHOTS_PER_SCOPE)
  const tx = db.transaction('contextSnapshots', 'readwrite')
  for (const snapshot of toDelete) {
    tx.objectStore('contextSnapshots').delete(snapshot.id)
  }
  await tx.done
}

export async function deleteContextSnapshotsByNovelId(novelId: string): Promise<void> {
  const db = await getDB()
  const snapshots = await getContextSnapshotsByNovelId(novelId)
  const tx = db.transaction('contextSnapshots', 'readwrite')
  for (const snapshot of snapshots) {
    tx.objectStore('contextSnapshots').delete(snapshot.id)
  }
  await tx.done
}
