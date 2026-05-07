/**
 * Tool display configuration.
 *
 * Defines how each tool's arguments and results render in the UI —
 * as human-readable fields instead of raw JSON.
 *
 * When adding a new tool, add its config here.
 */

import { i18n } from '@/i18n'

export type FieldType = 'text' | 'multiline' | 'badge' | 'list' | 'tags' | 'hidden'

export interface FieldDisplay {
  /** i18n key for the label shown to the user, resolved at render time */
  label: string
  /** Key path in the data object, e.g. "data.name" or "threeActs.act1.summary" */
  key: string
  /** Visual presentation */
  type: FieldType
  /** Optional value transform */
  transform?: (value: unknown) => string
}

export interface ToolDisplayConfig {
  /** Fields to show in the expanded args section */
  argFields?: FieldDisplay[]
  /** Fields to show in the expanded result section */
  resultFields?: FieldDisplay[]
  /** Preview string for the header bar (parsed args available). Return empty string to fall back */
  argPreview?: string | ((args: Record<string, unknown>) => string)
  /** Preview string for the header bar (parsed result available). Return empty string to fall back */
  resultPreview?: string | ((result: Record<string, unknown>) => string)
}

// ── helpers ────────────────────────────────────────────────

const { t } = i18n.global

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    protagonist: t('story.drawer.role.protagonist'),
    antagonist: t('story.drawer.role.antagonist'),
    supporting: t('story.drawer.role.supporting'),
    minor: t('story.drawer.role.minor'),
  }
  return map[role] ?? role
}

function perspectiveLabel(v: string): string {
  const map: Record<string, string> = {
    'first-person': t('story.tool.perspective.firstPerson'),
    'third-person-limited': t('story.tool.perspective.thirdLimited'),
    'third-person-omniscient': t('story.tool.perspective.thirdOmniscient'),
  }
  return map[v] ?? v
}

function tenseLabel(v: string): string {
  const map: Record<string, string> = {
    past: t('story.tool.tense.past'),
    present: t('story.tool.tense.present'),
  }
  return map[v] ?? v
}

function statusLabel(v: string): string {
  const map: Record<string, string> = {
    drafting: t('story.tool.status.drafting'),
    writing: t('story.tool.status.writing'),
    completed: t('story.tool.status.completed'),
    editing: t('story.tool.status.editing'),
    abandoned: t('story.tool.status.abandoned'),
    paused: t('story.tool.status.paused'),
    planned: t('story.tool.status.planned'),
    draft: t('story.tool.status.draft'),
    archived: t('story.tool.status.archived'),
  }
  return map[v] ?? v
}

// ── Configs ─────────────────────────────────────────────────

export const toolDisplayConfigs: Record<string, ToolDisplayConfig> = {
  // ── Story management ────────────────────────────────────

  upsert_story: {
    argFields: [
      { label: 'toolLabels.title', key: 'title', type: 'text' },
      { label: 'toolLabels.synopsis', key: 'synopsis', type: 'multiline' },
    ],
    resultFields: [
      {
        label: 'toolLabels.title',
        key: 'title',
        type: 'text',
        transform: (v) => t('toolTransforms.saved', { value: v }),
      },
    ],
    argPreview: (args) => String(args.title ?? ''),
    resultPreview: (r) => String(r.title ?? t('toolTransforms.success')),
  },

  get_story_status: {
    resultFields: [
      { label: 'toolLabels.title', key: 'title', type: 'text' },
      {
        label: 'toolLabels.status',
        key: 'status',
        type: 'badge',
        transform: (v) => statusLabel(v as string),
      },
      {
        label: 'toolLabels.wordCount',
        key: 'currentWordCount',
        type: 'text',
        transform: (v) => t('toolTransforms.wordsCount', { count: Number(v).toLocaleString() }),
      },
      { label: 'toolLabels.completedChapters', key: 'completedChapters', type: 'text' },
      {
        label: 'toolLabels.totalChapters',
        key: 'totalChapters',
        type: 'text',
        transform: (v) => t('toolTransforms.chaptersCount', { count: v }),
      },
      {
        label: 'toolLabels.characterCount',
        key: 'characterCount',
        type: 'text',
        transform: (v) => t('toolTransforms.charsCount', { count: v }),
      },
      {
        label: 'toolLabels.hasOutline',
        key: 'hasOutline',
        type: 'badge',
        transform: (v) => (v ? t('toolLabels.hasOutlineTrue') : t('toolLabels.hasOutlineFalse')),
      },
    ],
    resultPreview: (r) => {
      const chapters = t('toolTransforms.chaptersCount', { count: r.totalChapters ?? 0 })
      const words = t('toolTransforms.wordsCount', {
        count: Number(r.currentWordCount ?? 0).toLocaleString(),
      })
      return `${chapters} · ${words}`
    },
  },

  // ── Outline ─────────────────────────────────────────────

  upsert_outline: {
    argFields: [
      { label: 'toolLabels.premise', key: 'premise', type: 'multiline' },
      { label: 'toolLabels.act1Detail', key: 'act1', type: 'multiline' },
      { label: 'toolLabels.act2Detail', key: 'act2', type: 'multiline' },
      { label: 'toolLabels.act3Detail', key: 'act3', type: 'multiline' },
    ],
    resultFields: [{ label: 'toolLabels.status', key: 'success', type: 'hidden' }],
    resultPreview: () => t('toolTransforms.outlineCreated'),
  },

  update_outline: {
    argFields: [
      { label: 'toolLabels.premise', key: 'premise', type: 'multiline' },
      { label: 'toolLabels.act1', key: 'act1', type: 'multiline' },
      { label: 'toolLabels.act2', key: 'act2', type: 'multiline' },
      { label: 'toolLabels.act3', key: 'act3', type: 'multiline' },
      { label: 'toolLabels.act1KeyEvents', key: 'act1_keyEvents', type: 'list' },
      { label: 'toolLabels.act1CharacterArcs', key: 'act1_characterArcs', type: 'tags' },
      { label: 'toolLabels.act2KeyEvents', key: 'act2_keyEvents', type: 'list' },
      { label: 'toolLabels.act2CharacterArcs', key: 'act2_characterArcs', type: 'tags' },
      { label: 'toolLabels.act3KeyEvents', key: 'act3_keyEvents', type: 'list' },
      { label: 'toolLabels.act3CharacterArcs', key: 'act3_characterArcs', type: 'tags' },
    ],
    resultPreview: () => t('toolTransforms.outlineUpdated'),
  },

  get_outline: {
    resultFields: [
      { label: 'toolLabels.premise', key: 'premise', type: 'multiline' },
      { label: 'toolLabels.act1', key: 'threeActs.act1.summary', type: 'multiline' },
      { label: 'toolLabels.act2', key: 'threeActs.act2.summary', type: 'multiline' },
      { label: 'toolLabels.act3', key: 'threeActs.act3.summary', type: 'multiline' },
    ],
    resultPreview: (r) => ('premise' in r ? t('toolTransforms.outlineFetched') : ''),
  },

  // ── Chapters ────────────────────────────────────────────

  plan_chapters: {
    argFields: [
      {
        label: 'toolLabels.chapterPlan',
        key: 'chapters',
        type: 'list',
        transform: (v) => {
          const arr = v as
            | Array<{ title: string; summary: string; estimatedWordCount?: number }>
            | undefined
          if (!arr?.length) return ''
          return arr
            .map(
              (c, i) =>
                `${t('toolTransforms.chapterNumber', { index: i + 1 })} ${c.title}${c.estimatedWordCount ? ` (${t('toolTransforms.wordsCount', { count: c.estimatedWordCount.toLocaleString() })})` : ''}\n${c.summary}`,
            )
            .join('\n\n---\n\n')
        },
      },
    ],
    resultFields: [
      {
        label: 'toolLabels.planned',
        key: 'count',
        type: 'text',
        transform: (v) => t('toolTransforms.chaptersCount', { count: v }),
      },
    ],
    argPreview: (args) => {
      const chapters = args.chapters as Array<{ title: string }> | undefined
      return chapters?.length
        ? `${t('toolTransforms.chaptersCount', { count: chapters.length })} · ${chapters
            .map((c) => c.title)
            .slice(0, 3)
            .join(', ')}${chapters.length > 3 ? '…' : ''}`
        : ''
    },
    resultPreview: (r) => t('toolTransforms.chaptersPlanDone', { count: r.count }),
  },

  write_chapter: {
    argFields: [
      {
        label: 'toolLabels.index',
        key: 'index',
        type: 'text',
        transform: (v) => t('toolTransforms.chapterNumber', { index: Number(v) + 1 }),
      },
      { label: 'toolLabels.content', key: 'content', type: 'multiline' },
    ],
    resultFields: [
      {
        label: 'toolLabels.wordCount',
        key: 'wordCount',
        type: 'text',
        transform: (v) => t('toolTransforms.wordsCount', { count: Number(v).toLocaleString() }),
      },
    ],
    argPreview: (args) => {
      const idx = args.index as number
      const chapter =
        typeof idx === 'number' ? t('toolTransforms.chapterNumber', { index: idx + 1 }) : ''
      const content = args.content as string | undefined
      const preview = content ? content.replace(/\n/g, ' ').slice(0, 30) : ''
      return [chapter, preview].filter(Boolean).join(' · ')
    },
    resultPreview: (r) =>
      t('toolTransforms.chapterWritten', {
        wordCount: Number(r.wordCount ?? 0).toLocaleString(),
      }),
  },

  get_chapter: {
    argFields: [
      {
        label: 'toolLabels.index',
        key: 'index',
        type: 'text',
        transform: (v) => t('toolTransforms.chapterNumber', { index: Number(v) + 1 }),
      },
    ],
    resultFields: [
      { label: 'toolLabels.title', key: 'title', type: 'text' },
      {
        label: 'toolLabels.status',
        key: 'status',
        type: 'badge',
        transform: (v) => statusLabel(v as string),
      },
      {
        label: 'toolLabels.wordCount',
        key: 'wordCount',
        type: 'text',
        transform: (v) => t('toolTransforms.wordsCount', { count: Number(v).toLocaleString() }),
      },
      { label: 'toolLabels.summary', key: 'summary', type: 'multiline' },
      { label: 'toolLabels.contentPreview', key: 'content', type: 'multiline' },
    ],
    resultPreview: (r) =>
      'title' in r
        ? `${t('toolTransforms.chapterNumber', { index: Number(r.index ?? 0) + 1 })} · ${r.title}`
        : '',
  },

  list_chapters: {
    resultFields: [
      {
        label: 'toolLabels.chapterCount',
        key: 'count',
        type: 'text',
        transform: (v) => t('toolTransforms.chaptersCount', { count: v }),
      },
      {
        label: 'toolLabels.chapterList',
        key: 'chapters',
        type: 'list',
        transform: (v) => {
          const chapters = v as
            | Array<{ index: number; title: string; status: string; wordCount: number }>
            | undefined
          if (!chapters?.length) return t('toolTransforms.noChapters')
          return chapters
            .map(
              (c) =>
                `${t('toolTransforms.chapterNumber', { index: c.index + 1 })} ${c.title} (${statusLabel(c.status)}, ${t('toolTransforms.wordsCount', { count: c.wordCount.toLocaleString() })})`,
            )
            .join('\n')
        },
      },
    ],
    resultPreview: (r) => t('toolTransforms.chaptersCount', { count: r.count ?? 0 }),
  },

  delete_chapter: {
    argFields: [
      {
        label: 'toolLabels.index',
        key: 'index',
        type: 'text',
        transform: (v) => t('toolTransforms.chapterNumber', { index: Number(v) + 1 }),
      },
    ],
    resultPreview: (r) =>
      t('toolTransforms.chapterDeleted', {
        index: Number(r.deletedIndex ?? 0) + 1,
        title: r.title ?? '',
      }),
  },

  search_content: {
    argFields: [{ label: 'toolLabels.query', key: 'query', type: 'text' }],
    resultFields: [
      {
        label: 'toolLabels.matchCount',
        key: 'matchCount',
        type: 'text',
        transform: (v) => t('toolTransforms.matchCount', { count: v }),
      },
      {
        label: 'toolLabels.results',
        key: 'results',
        type: 'list',
        transform: (v) => {
          const results = v as Array<{ index: number; title: string; snippet: string }> | undefined
          if (!results?.length) return t('toolTransforms.noMatches')
          return results
            .map(
              (r) =>
                `${t('toolTransforms.chapterNumber', { index: r.index + 1 })} ${r.title}\n${r.snippet}`,
            )
            .join('\n\n---\n\n')
        },
      },
    ],
    argPreview: (args) => String(args.query ?? ''),
    resultPreview: (r) => t('toolTransforms.matchCount', { count: r.matchCount ?? 0 }),
  },

  // ── Characters ──────────────────────────────────────────

  create_character: {
    argFields: [
      { label: 'toolLabels.name', key: 'name', type: 'text' },
      {
        label: 'toolLabels.role',
        key: 'role',
        type: 'badge',
        transform: (v) => roleLabel(v as string),
      },
      { label: 'toolLabels.appearance', key: 'appearance', type: 'multiline' },
      { label: 'toolLabels.personality', key: 'personality', type: 'multiline' },
      { label: 'toolLabels.background', key: 'background', type: 'multiline' },
      { label: 'toolLabels.motivation', key: 'motivation', type: 'multiline' },
      { label: 'toolLabels.arc', key: 'arc', type: 'multiline' },
    ],
    resultFields: [
      {
        label: 'toolLabels.name',
        key: 'data.name',
        type: 'text',
        transform: (v) => t('toolTransforms.created', { value: v }),
      },
      {
        label: 'toolLabels.role',
        key: 'data.role',
        type: 'badge',
        transform: (v) => roleLabel(v as string),
      },
    ],
    argPreview: (args) =>
      `${args.name ?? t('story.drawer.unnamed')} (${roleLabel(args.role as string)})`,
    resultPreview: (r) => {
      const data = r.data as Record<string, unknown> | undefined
      return data?.name
        ? t('toolTransforms.created', { value: data.name })
        : t('toolTransforms.characterCreated')
    },
  },

  update_character: {
    argFields: [
      { label: 'toolLabels.characterId', key: 'characterId', type: 'hidden' },
      { label: 'toolLabels.name', key: 'name', type: 'text' },
      {
        label: 'toolLabels.role',
        key: 'role',
        type: 'badge',
        transform: (v) => roleLabel(v as string),
      },
      { label: 'toolLabels.appearance', key: 'appearance', type: 'multiline' },
      { label: 'toolLabels.personality', key: 'personality', type: 'multiline' },
      { label: 'toolLabels.background', key: 'background', type: 'multiline' },
      { label: 'toolLabels.motivation', key: 'motivation', type: 'multiline' },
      { label: 'toolLabels.arc', key: 'arc', type: 'multiline' },
      {
        label: 'toolLabels.relationships',
        key: 'relationships',
        type: 'list',
        transform: (v) => {
          const rels = v as
            | Array<{ characterName: string; relation: string; description?: string }>
            | undefined
          if (!rels?.length) return ''
          return rels
            .map(
              (r) =>
                `${r.characterName} (${r.relation})${r.description ? `: ${r.description}` : ''}`,
            )
            .join('\n')
        },
      },
    ],
    resultFields: [
      {
        label: 'toolLabels.name',
        key: 'data.name',
        type: 'text',
        transform: (v) => t('toolTransforms.updated', { value: v }),
      },
    ],
    argPreview: (args) =>
      args.name
        ? `${args.name} (${roleLabel(args.role as string)})`
        : t('toolTransforms.characterUpdated'),
    resultPreview: (r) => {
      const data = r.data as Record<string, unknown> | undefined
      return data?.name
        ? t('toolTransforms.updated', { value: data.name })
        : t('toolTransforms.characterUpdated')
    },
  },

  delete_character: {
    resultFields: [{ label: 'toolLabels.status', key: 'success', type: 'hidden' }],
    resultPreview: () => t('toolTransforms.characterDeleted'),
  },

  get_character: {
    argFields: [{ label: 'toolLabels.characterId', key: 'characterId', type: 'text' }],
    resultFields: [
      { label: 'toolLabels.name', key: 'name', type: 'text' },
      {
        label: 'toolLabels.role',
        key: 'role',
        type: 'badge',
        transform: (v) => roleLabel(v as string),
      },
      { label: 'toolLabels.appearance', key: 'appearance', type: 'multiline' },
      { label: 'toolLabels.personality', key: 'personality', type: 'multiline' },
      { label: 'toolLabels.background', key: 'background', type: 'multiline' },
      { label: 'toolLabels.motivation', key: 'motivation', type: 'multiline' },
      { label: 'toolLabels.arc', key: 'arc', type: 'multiline' },
      {
        label: 'toolLabels.relationships',
        key: 'relationships',
        type: 'list',
        transform: (v) => {
          const rels = v as
            | Array<{ characterName: string; relation: string; description?: string }>
            | undefined
          if (!rels?.length) return ''
          return rels.map((r) => `${r.characterName} (${r.relation})`.trim()).join('\n')
        },
      },
    ],
    resultPreview: (r) => ('name' in r ? `${r.name} (${roleLabel(r.role as string)})` : ''),
  },

  list_characters: {
    resultFields: [
      {
        label: 'toolLabels.characterCount',
        key: 'count',
        type: 'text',
        transform: (v) => t('toolTransforms.charsCount', { count: v }),
      },
      {
        label: 'toolLabels.characterList',
        key: 'characters',
        type: 'list',
        transform: (v) => {
          const chars = v as Array<{ name: string; role: string }> | undefined
          if (!chars?.length) return t('toolTransforms.noCharacters')
          return chars.map((c) => `${c.name} (${roleLabel(c.role)})`).join('\n')
        },
      },
    ],
    resultPreview: (r) => t('toolTransforms.characterCountLabel', { count: r.count ?? 0 }),
  },

  // ── World building ──────────────────────────────────────

  upsert_world_building: {
    argFields: [
      { label: 'toolLabels.era', key: 'era', type: 'text' },
      { label: 'toolLabels.location', key: 'location', type: 'text' },
      { label: 'toolLabels.rules', key: 'rules', type: 'multiline' },
      { label: 'toolLabels.culture', key: 'culture', type: 'multiline' },
      {
        label: 'toolLabels.factions',
        key: 'factions',
        type: 'tags',
        transform: (v) => {
          const factions = v as Array<{ name: string }> | undefined
          return factions?.map((f) => f.name).join(', ') ?? ''
        },
      },
      { label: 'toolLabels.notes', key: 'notes', type: 'multiline' },
    ],
    resultPreview: () => t('toolTransforms.worldBuildingSet'),
  },

  get_world_building: {
    resultFields: [
      { label: 'toolLabels.era', key: 'era', type: 'text' },
      { label: 'toolLabels.location', key: 'location', type: 'text' },
      { label: 'toolLabels.rules', key: 'rules', type: 'multiline' },
      { label: 'toolLabels.culture', key: 'culture', type: 'multiline' },
      {
        label: 'toolLabels.factions',
        key: 'factions',
        type: 'tags',
        transform: (v) => {
          const factions = v as Array<{ name: string }> | undefined
          return factions?.map((f) => f.name).join(', ') ?? ''
        },
      },
      { label: 'toolLabels.notes', key: 'notes', type: 'multiline' },
    ],
    resultPreview: (r) => ('era' in r ? `${r.era} · ${r.location}` : ''),
  },

  // ── Style ───────────────────────────────────────────────

  set_style: {
    argFields: [
      {
        label: 'toolLabels.narrativePerspective',
        key: 'narrativePerspective',
        type: 'badge',
        transform: (v) => perspectiveLabel(v as string),
      },
      {
        label: 'toolLabels.tense',
        key: 'tense',
        type: 'badge',
        transform: (v) => tenseLabel(v as string),
      },
      { label: 'toolLabels.languageStyle', key: 'languageStyle', type: 'text' },
    ],
    resultPreview: () => t('toolTransforms.styleSet'),
  },

  get_style: {
    resultFields: [
      {
        label: 'toolLabels.narrativePerspective',
        key: 'narrativePerspective',
        type: 'badge',
        transform: (v) => perspectiveLabel(v as string),
      },
      {
        label: 'toolLabels.tense',
        key: 'tense',
        type: 'badge',
        transform: (v) => tenseLabel(v as string),
      },
      { label: 'toolLabels.languageStyle', key: 'languageStyle', type: 'text' },
    ],
    resultPreview: (r) =>
      'narrativePerspective' in r
        ? `${perspectiveLabel(String(r.narrativePerspective ?? ''))} · ${tenseLabel(String(r.tense ?? ''))}`
        : '',
  },

  // ── Roleplay ─────────────────────────────────────────────

  render_message: {
    argPreview: (args) => {
      const messages = args.messages as Array<{ role: string }> | undefined
      return messages?.length ? t('roleplay.tool.messageCount', { count: messages.length }) : ''
    },
    resultPreview: (r) =>
      r.success ? t('roleplay.tool.messageCount', { count: r.count ?? 0 }) : '',
  },

  render_choice: {
    argPreview: (args) => String(args.prompt ?? ''),
    resultPreview: (r) =>
      r.pending ? t('roleplay.tool.awaitingChoice') : t('roleplay.tool.choiceMade'),
  },

  update_sidebar: {
    argPreview: (args) => {
      const groups = args.groups as Array<{ title: string }> | undefined
      return groups?.length ? t('roleplay.tool.groupCount', { count: groups.length }) : ''
    },
    resultPreview: (r) => (r.success ? t('toolTransforms.success') : ''),
  },
}

// ── Lookup ──────────────────────────────────────────────────

export function getToolDisplayConfig(toolName: string): ToolDisplayConfig | undefined {
  return toolDisplayConfigs[toolName]
}

export function getField(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}
