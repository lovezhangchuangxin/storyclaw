import { getDB } from './index'
import type { RoleplaySession } from './roleplay-types'

export async function getAllRoleplaySessions(): Promise<RoleplaySession[]> {
  const db = await getDB()
  if (!db.objectStoreNames.contains('roleplaySessions')) return []
  return db.getAll('roleplaySessions')
}

export async function getRoleplaySessionById(id: string): Promise<RoleplaySession | undefined> {
  const db = await getDB()
  if (!db.objectStoreNames.contains('roleplaySessions')) return undefined
  return db.get('roleplaySessions', id)
}

export async function saveRoleplaySession(session: RoleplaySession): Promise<void> {
  const db = await getDB()
  await db.put('roleplaySessions', { ...session, updatedAt: Date.now() })
}

export async function deleteRoleplaySession(id: string): Promise<void> {
  const db = await getDB()
  const allStoreNames = db.objectStoreNames
  if (
    !allStoreNames.contains('roleplaySessions') &&
    !allStoreNames.contains('roleplayConversations') &&
    !allStoreNames.contains('contextSnapshots')
  ) {
    return
  }

  const storeNames: ('roleplaySessions' | 'roleplayConversations' | 'contextSnapshots')[] = []
  if (allStoreNames.contains('roleplaySessions')) storeNames.push('roleplaySessions')
  if (allStoreNames.contains('roleplayConversations')) storeNames.push('roleplayConversations')
  if (allStoreNames.contains('contextSnapshots')) storeNames.push('contextSnapshots')

  const tx = db.transaction(storeNames, 'readwrite')

  if (storeNames.includes('contextSnapshots')) {
    const snapshotKeys = await tx.objectStore('contextSnapshots').index('novelId').getAllKeys(id)
    await Promise.all(
      snapshotKeys.map((key) => tx.objectStore('contextSnapshots').delete(key as string)),
    )
  }

  if (storeNames.includes('roleplaySessions')) {
    await tx.objectStore('roleplaySessions').delete(id)
  }
  if (storeNames.includes('roleplayConversations')) {
    await tx.objectStore('roleplayConversations').delete(id)
  }

  await tx.done
}
