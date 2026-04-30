import { getDB } from './index'
import type { Conversation } from './types'

export async function getConversationByNovelId(novelId: string): Promise<Conversation | undefined> {
  const db = await getDB()
  return db.get('conversations', novelId)
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const db = await getDB()
  await db.put('conversations', conversation)
}

export async function deleteConversation(novelId: string): Promise<void> {
  const db = await getDB()
  await db.delete('conversations', novelId)
}
