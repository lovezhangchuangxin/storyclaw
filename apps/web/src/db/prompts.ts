import { getDB } from './index'
import type { Prompt } from './types'
import { i18n } from '@/i18n'
import { ROLEPLAY_DEFAULT_PERSONA } from '@/agent/roleplay-persona'
import { CULTIVATION_PERSONA } from '@/agent/cultivation-persona'

let roleplayPromptEnsured = false
let cultivationPromptEnsured = false

export async function ensureRoleplayBuiltinPrompt(): Promise<void> {
  if (roleplayPromptEnsured) return
  try {
    const db = await getDB()
    const existing = await db.get('prompts', 'builtin-roleplay-default')
    const latest = {
      id: 'builtin-roleplay-default',
      name: i18n.global.t('db.defaultRoleplay'),
      content: ROLEPLAY_DEFAULT_PERSONA,
      initialMessage: '',
      isBuiltin: true,
      scenario: 'roleplay' as const,
      createdAt: existing?.createdAt ?? 0,
      updatedAt: Date.now(),
    }
    await db.put('prompts', latest)
    roleplayPromptEnsured = true
  } catch {
    // Non-critical — will retry on next call
  }
}

export async function ensureCultivationBuiltinPrompt(): Promise<void> {
  if (cultivationPromptEnsured) return
  try {
    const db = await getDB()
    const existing = await db.get('prompts', 'builtin-cultivation')
    const latest = {
      id: 'builtin-cultivation',
      name: i18n.global.t('db.defaultCultivation'),
      content: CULTIVATION_PERSONA,
      initialMessage: '轮回百世、流连今生',
      isBuiltin: true,
      scenario: 'roleplay' as const,
      createdAt: existing?.createdAt ?? 0,
      updatedAt: Date.now(),
    }
    await db.put('prompts', latest)
    cultivationPromptEnsured = true
  } catch {
    // Non-critical — will retry on next call
  }
}

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
