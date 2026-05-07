import { getDB } from './index'
import type { RoleplayConversation } from './roleplay-types'

export async function getRoleplayConversationBySessionId(
  sessionId: string,
): Promise<RoleplayConversation | undefined> {
  const db = await getDB()
  if (!db.objectStoreNames.contains('roleplayConversations')) return undefined
  return db.get('roleplayConversations', sessionId)
}

export async function saveRoleplayConversation(conv: RoleplayConversation): Promise<void> {
  const db = await getDB()
  if (!db.objectStoreNames.contains('roleplayConversations')) return
  await db.put('roleplayConversations', conv)
}

export async function deleteRoleplayConversation(sessionId: string): Promise<void> {
  const db = await getDB()
  if (!db.objectStoreNames.contains('roleplayConversations')) return
  await db.delete('roleplayConversations', sessionId)
}
