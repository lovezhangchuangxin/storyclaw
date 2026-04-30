import { getDB } from './index'
import type { Character } from './types'

export async function getCharactersByNovelId(novelId: string): Promise<Character[]> {
  const db = await getDB()
  return db.getAllFromIndex('characters', 'novelId', novelId)
}

export async function getCharacterById(
  novelId: string,
  characterId: string,
): Promise<Character | undefined> {
  const db = await getDB()
  return db.get('characters', [novelId, characterId])
}

export async function saveCharacter(character: Character): Promise<void> {
  const db = await getDB()
  await db.put('characters', character)
}

export async function deleteCharacter(novelId: string, characterId: string): Promise<void> {
  const db = await getDB()
  await db.delete('characters', [novelId, characterId])
}
