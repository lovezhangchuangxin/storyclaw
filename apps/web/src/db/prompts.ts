import { getDB } from './index'
import type { Prompt } from './types'
import { i18n } from '@/i18n'

export async function getAllPrompts(): Promise<Prompt[]> {
  const db = await getDB()
  return db.getAll('prompts')
}

export async function getPromptById(id: string): Promise<Prompt | undefined> {
  const db = await getDB()
  return db.get('prompts', id)
}

export async function getPromptsByIds(ids: string[]): Promise<Prompt[]> {
  const db = await getDB()
  const prompts = await Promise.all(ids.map((id) => db.get('prompts', id)))
  return prompts.filter((p): p is Prompt => p !== undefined)
}

export async function isPromptNameDuplicate(name: string, excludeId?: string): Promise<boolean> {
  const all = await getAllPrompts()
  const trimmed = name.trim()
  return all.some((p) => p.name.trim() === trimmed && p.id !== excludeId)
}

export async function savePrompt(prompt: Prompt): Promise<void> {
  const db = await getDB()
  await db.put('prompts', prompt)
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await getDB()
  const prompt = await db.get('prompts', id)
  if (prompt?.isBuiltin) {
    throw new Error(i18n.global.t('error.builtinPromptDelete'))
  }
  await db.delete('prompts', id)
}
