import { getChaptersByNovelId } from '@/db/chapters'
import { getCharactersByNovelId } from '@/db/characters'
import { getNovelById } from '@/db/novels'
import { getOutlineByNovelId } from '@/db/outlines'
import { getWorldBuildingByNovelId } from '@/db/worldBuilding'
import type {
  Chapter,
  Character,
  Novel,
  Outline,
  WorldBuilding,
} from '@/db/types'

export interface StoryStateSnapshot {
  novel: Pick<
    Novel,
    | 'id'
    | 'title'
    | 'synopsis'
    | 'genre'
    | 'targetWordCount'
    | 'currentWordCount'
    | 'status'
    | 'styleSettings'
  > | null
  outline: OutlineSnapshot | null
  characters: CharacterSnapshot[]
  chapters: ChapterSnapshot[]
  worldBuilding: WorldBuildingSnapshot | null
}

export interface OutlineSnapshot {
  premise: string
  threeActs: {
    act1: {
      summary: string
      keyEvents: string[]
      characterArcs: string[]
    }
    act2: {
      summary: string
      keyEvents: string[]
      characterArcs: string[]
    }
    act3: {
      summary: string
      keyEvents: string[]
      characterArcs: string[]
    }
  }
  chapterPlan: Array<{
    index: number
    title: string
    summary: string
    estimatedWordCount: number
    pointOfView: string
    status: string
  }>
  updatedAt: number
}

export interface CharacterSnapshot {
  id: string
  name: string
  role: Character['role']
  appearance: string
  personality: string
  background: string
  motivation: string
  arc: string
  relationships: Array<{
    characterId: string
    characterName: string
    relation: string
    description: string
  }>
  updatedAt: number
}

export interface ChapterSnapshot {
  index: number
  title: string
  status: Chapter['status']
  pointOfView: string
  summary: string
  wordCount: number
  scenes: Array<{
    id: string
    title: string
    content: string
  }>
  updatedAt: number
}

export interface WorldBuildingSnapshot {
  era: string
  location: string
  rules: string
  culture: string
  factions: Array<{
    name: string
    description: string
    goals: string
  }>
  notes: string
  updatedAt: number
}

function compactText(text: string, limit = 400): string {
  const normalized = text.trim()
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit).trimEnd()}…`
}

function serializeNovel(novel: Novel | undefined): StoryStateSnapshot['novel'] {
  if (!novel) return null
  return {
    id: novel.id,
    title: novel.title,
    synopsis: compactText(novel.synopsis, 800),
    genre: novel.genre,
    targetWordCount: novel.targetWordCount,
    currentWordCount: novel.currentWordCount,
    status: novel.status,
    styleSettings: {
      narrativePerspective: novel.styleSettings.narrativePerspective,
      tense: novel.styleSettings.tense,
      languageStyle: novel.styleSettings.languageStyle,
      customPrompt: novel.styleSettings.customPrompt ?? '',
    },
  }
}

function serializeOutline(outline: Outline | undefined): StoryStateSnapshot['outline'] {
  if (!outline) return null

  const threeActs = {
    act1: {
      summary: compactText(outline.threeActs.act1.summary, 600),
      keyEvents: outline.threeActs.act1.keyEvents.map((item) => compactText(item, 180)).filter(Boolean),
      characterArcs: outline.threeActs.act1.characterArcs.map((item) => compactText(item, 180)).filter(Boolean),
    },
    act2: {
      summary: compactText(outline.threeActs.act2.summary, 600),
      keyEvents: outline.threeActs.act2.keyEvents.map((item) => compactText(item, 180)).filter(Boolean),
      characterArcs: outline.threeActs.act2.characterArcs.map((item) => compactText(item, 180)).filter(Boolean),
    },
    act3: {
      summary: compactText(outline.threeActs.act3.summary, 600),
      keyEvents: outline.threeActs.act3.keyEvents.map((item) => compactText(item, 180)).filter(Boolean),
      characterArcs: outline.threeActs.act3.characterArcs.map((item) => compactText(item, 180)).filter(Boolean),
    },
  }

  return {
    premise: compactText(outline.premise, 800),
    threeActs,
    chapterPlan: outline.chapterPlan
      .slice()
      .toSorted((left, right) => left.index - right.index)
      .map((chapter) => ({
        index: chapter.index,
        title: chapter.title,
        summary: compactText(chapter.summary, 400),
        estimatedWordCount: chapter.estimatedWordCount,
        pointOfView: chapter.pointOfView,
        status: chapter.status,
      })),
    updatedAt: outline.updatedAt,
  }
}

function serializeCharacters(characters: Character[]): CharacterSnapshot[] {
  return characters
    .slice()
    .toSorted((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN') || left.id.localeCompare(right.id))
    .map((character) => ({
      id: character.id,
      name: character.name,
      role: character.role,
      appearance: compactText(character.appearance, 300),
      personality: compactText(character.personality, 300),
      background: compactText(character.background, 400),
      motivation: compactText(character.motivation, 240),
      arc: compactText(character.arc, 240),
      relationships: character.relationships
        .slice()
        .toSorted((left, right) => left.characterName.localeCompare(right.characterName, 'zh-Hans-CN'))
        .map((relationship) => ({
          characterId: relationship.characterId,
          characterName: relationship.characterName,
          relation: compactText(relationship.relation, 120),
          description: compactText(relationship.description, 240),
        })),
      updatedAt: character.updatedAt,
    }))
}

function serializeChapters(chapters: Chapter[]): ChapterSnapshot[] {
  return chapters
    .slice()
    .toSorted((left, right) => left.index - right.index)
    .map((chapter) => ({
      index: chapter.index,
      title: chapter.title,
      status: chapter.status,
      pointOfView: chapter.pointOfView ?? '',
      summary: compactText(chapter.summary ?? chapter.content, 600),
      wordCount: chapter.wordCount,
      scenes: chapter.scenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        content: compactText(scene.content, 240),
      })),
      updatedAt: chapter.updatedAt,
    }))
}

function serializeWorldBuilding(
  worldBuilding: WorldBuilding | undefined,
): StoryStateSnapshot['worldBuilding'] {
  if (!worldBuilding) return null

  return {
    era: compactText(worldBuilding.era, 120),
    location: compactText(worldBuilding.location, 160),
    rules: compactText(worldBuilding.rules, 600),
    culture: compactText(worldBuilding.culture, 400),
    factions: worldBuilding.factions.map((faction) => ({
      name: compactText(faction.name, 80),
      description: compactText(faction.description, 240),
      goals: compactText(faction.goals, 240),
    })),
    notes: compactText(worldBuilding.notes, 600),
    updatedAt: worldBuilding.updatedAt,
  }
}

export async function loadStoryState(novelId: string): Promise<StoryStateSnapshot> {
  const [novel, outline, characters, chapters, worldBuilding] = await Promise.all([
    getNovelById(novelId),
    getOutlineByNovelId(novelId),
    getCharactersByNovelId(novelId),
    getChaptersByNovelId(novelId),
    getWorldBuildingByNovelId(novelId),
  ])

  return {
    novel: serializeNovel(novel),
    outline: serializeOutline(outline),
    characters: serializeCharacters(characters),
    chapters: serializeChapters(chapters),
    worldBuilding: serializeWorldBuilding(worldBuilding),
  }
}

export function serializeStoryState(snapshot: StoryStateSnapshot): string {
  return JSON.stringify(
    {
      storyStateVersion: 1,
      novel: snapshot.novel,
      outline: snapshot.outline,
      characters: snapshot.characters,
      chapters: snapshot.chapters,
      worldBuilding: snapshot.worldBuilding,
    },
    null,
    2,
  )
}
