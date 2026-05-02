/**
 * Tool display configuration.
 *
 * Defines how each tool's arguments and results render in the UI —
 * as human-readable fields instead of raw JSON.
 *
 * When adding a new tool, add its config here.
 */

export type FieldType = 'text' | 'multiline' | 'badge' | 'list' | 'tags' | 'hidden'

export interface FieldDisplay {
  /** Chinese label shown to the user */
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

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    protagonist: '主角',
    antagonist: '反角',
    supporting: '配角',
    minor: '次要',
  }
  return map[role] ?? role
}

function perspectiveLabel(v: string): string {
  const map: Record<string, string> = {
    'first-person': '第一人称',
    'third-person-limited': '第三人称有限',
    'third-person-omniscient': '第三人称全知',
  }
  return map[v] ?? v
}

function tenseLabel(v: string): string {
  const map: Record<string, string> = {
    past: '过去时',
    present: '现在时',
  }
  return map[v] ?? v
}

function statusLabel(v: string): string {
  const map: Record<string, string> = {
    drafting: '起草中',
    completed: '已完成',
    editing: '编辑中',
    abandoned: '已弃坑',
    planned: '已规划',
  }
  return map[v] ?? v
}

// ── Configs ─────────────────────────────────────────────────

export const toolDisplayConfigs: Record<string, ToolDisplayConfig> = {

  // ── Story management ────────────────────────────────────

  upsert_story: {
    argFields: [
      { label: '标题', key: 'title', type: 'text' },
      { label: '简介', key: 'synopsis', type: 'multiline' },
    ],
    resultFields: [
      { label: '标题', key: 'title', type: 'text', transform: (v) => `已保存：${v}` },
    ],
    argPreview: (args) => String(args.title ?? ''),
    resultPreview: (r) => String(r.title ?? '操作成功'),
  },

  get_story_status: {
    resultFields: [
      { label: '标题', key: 'title', type: 'text' },
      { label: '状态', key: 'status', type: 'badge', transform: (v) => statusLabel(v as string) },
      { label: '字数', key: 'currentWordCount', type: 'text', transform: (v) => `${Number(v).toLocaleString()} 字` },
      { label: '已完成', key: 'completedChapters', type: 'text' },
      { label: '总章节', key: 'totalChapters', type: 'text', transform: (v) => `${v} 章` },
      { label: '角色', key: 'characterCount', type: 'text', transform: (v) => `${v} 位` },
      { label: '大纲', key: 'hasOutline', type: 'badge', transform: (v) => v ? '已有大纲' : '暂无大纲' },
    ],
    resultPreview: (r) => `${r.totalChapters ?? 0} 章 · ${Number(r.currentWordCount ?? 0).toLocaleString()} 字`,
  },

  generate_title: {
    argFields: [
      { label: '新标题', key: 'title', type: 'text' },
    ],
    resultFields: [
      { label: '标题', key: 'title', type: 'text', transform: (v) => `已更新为：${v}` },
    ],
    resultPreview: (r) => `标题已生成：${r.title}`,
  },

  generate_synopsis: {
    argFields: [
      { label: '简介', key: 'synopsis', type: 'multiline' },
    ],
    resultFields: [
      { label: '状态', key: 'success', type: 'badge', transform: () => '简介已生成' },
    ],
    resultPreview: () => '简介已更新',
  },

  // ── Outline ─────────────────────────────────────────────

  create_outline: {
    argFields: [
      { label: '前提', key: 'premise', type: 'multiline' },
      { label: '第一幕 · 建置', key: 'act1', type: 'multiline' },
      { label: '第二幕 · 对抗', key: 'act2', type: 'multiline' },
      { label: '第三幕 · 解决', key: 'act3', type: 'multiline' },
    ],
    resultFields: [
      { label: '状态', key: 'success', type: 'hidden' },
    ],
    resultPreview: () => '大纲已创建',
  },

  update_outline: {
    argFields: [
      { label: '前提', key: 'premise', type: 'multiline' },
      { label: '第一幕', key: 'act1', type: 'multiline' },
      { label: '第二幕', key: 'act2', type: 'multiline' },
      { label: '第三幕', key: 'act3', type: 'multiline' },
      { label: '第一幕关键事件', key: 'act1_keyEvents', type: 'list' },
      { label: '第一幕角色弧线', key: 'act1_characterArcs', type: 'tags' },
      { label: '第二幕关键事件', key: 'act2_keyEvents', type: 'list' },
      { label: '第二幕角色弧线', key: 'act2_characterArcs', type: 'tags' },
      { label: '第三幕关键事件', key: 'act3_keyEvents', type: 'list' },
      { label: '第三幕角色弧线', key: 'act3_characterArcs', type: 'tags' },
    ],
    resultPreview: () => '大纲已更新',
  },

  get_outline: {
    resultFields: [
      { label: '前提', key: 'premise', type: 'multiline' },
      { label: '第一幕', key: 'threeActs.act1.summary', type: 'multiline' },
      { label: '第二幕', key: 'threeActs.act2.summary', type: 'multiline' },
      { label: '第三幕', key: 'threeActs.act3.summary', type: 'multiline' },
    ],
    resultPreview: (r) => '前提' in r ? '大纲已获取' : '',
  },

  // ── Chapters ────────────────────────────────────────────

  plan_chapters: {
    argFields: [
      { label: '章节规划', key: 'chapters', type: 'list', transform: (v) => {
        const arr = v as Array<{ title: string; summary: string; estimatedWordCount?: number }> | undefined
        if (!arr?.length) return ''
        return arr.map((c, i) =>
          `第${i + 1}章 ${c.title}${c.estimatedWordCount ? ` (约${c.estimatedWordCount}字)` : ''}\n${c.summary}`
        ).join('\n\n---\n\n')
      }},
    ],
    resultFields: [
      { label: '已规划', key: 'count', type: 'text', transform: (v) => `${v} 章` },
    ],
    argPreview: (args) => {
      const chapters = args.chapters as Array<{ title: string }> | undefined
      return chapters?.length ? `${chapters.length} 章 · ${chapters.map(c => c.title).slice(0, 3).join('、')}${chapters.length > 3 ? '…' : ''}` : ''
    },
    resultPreview: (r) => `${r.count} 章规划完成`,
  },

  write_chapter: {
    argFields: [
      { label: '章节', key: 'index', type: 'text', transform: (v) => `第${Number(v) + 1}章` },
      { label: '正文', key: 'content', type: 'multiline' },
    ],
    resultFields: [
      { label: '字数', key: 'wordCount', type: 'text', transform: (v) => `${Number(v).toLocaleString()} 字` },
    ],
    argPreview: (args) => {
      const idx = args.index as number
      const chapter = typeof idx === 'number' ? `第${idx + 1}章` : ''
      const content = args.content as string | undefined
      const preview = content ? content.replace(/\n/g, ' ').slice(0, 30) : ''
      return [chapter, preview].filter(Boolean).join(' · ')
    },
    resultPreview: (r) => `${Number(r.wordCount ?? 0).toLocaleString()} 字 · 已完成`,
  },

  rewrite_chapter: {
    argFields: [
      { label: '章节', key: 'index', type: 'text', transform: (v) => `第${Number(v) + 1}章` },
      { label: '重写内容', key: 'content', type: 'multiline' },
    ],
    resultFields: [
      { label: '字数', key: 'wordCount', type: 'text', transform: (v) => `${Number(v).toLocaleString()} 字` },
    ],
    argPreview: (args) => {
      const idx = args.index as number
      const chapter = typeof idx === 'number' ? `第${idx + 1}章` : ''
      const content = args.content as string | undefined
      const preview = content ? content.replace(/\n/g, ' ').slice(0, 30) : ''
      return [chapter, preview].filter(Boolean).join(' · ')
    },
    resultPreview: (r) => `${Number(r.wordCount ?? 0).toLocaleString()} 字 · 已重写`,
  },

  get_chapter: {
    argFields: [
      { label: '章节', key: 'index', type: 'text', transform: (v) => `第${Number(v) + 1}章` },
    ],
    resultFields: [
      { label: '标题', key: 'title', type: 'text' },
      { label: '状态', key: 'status', type: 'badge', transform: (v) => statusLabel(v as string) },
      { label: '字数', key: 'wordCount', type: 'text', transform: (v) => `${Number(v).toLocaleString()} 字` },
      { label: '概要', key: 'summary', type: 'multiline' },
      { label: '正文预览', key: 'content', type: 'multiline' },
    ],
    resultPreview: (r) => 'title' in r ? `第${Number(r.index ?? 0) + 1}章 · ${r.title}` : '',
  },

  // ── Characters ──────────────────────────────────────────

  create_character: {
    argFields: [
      { label: '姓名', key: 'name', type: 'text' },
      { label: '定位', key: 'role', type: 'badge', transform: (v) => roleLabel(v as string) },
      { label: '外貌', key: 'appearance', type: 'multiline' },
      { label: '性格', key: 'personality', type: 'multiline' },
      { label: '背景', key: 'background', type: 'multiline' },
      { label: '动机', key: 'motivation', type: 'multiline' },
      { label: '成长弧线', key: 'arc', type: 'multiline' },
    ],
    resultFields: [
      { label: '姓名', key: 'data.name', type: 'text', transform: (v) => `已创建：${v}` },
      { label: '定位', key: 'data.role', type: 'badge', transform: (v) => roleLabel(v as string) },
    ],
    argPreview: (args) => `${args.name ?? '未命名'} (${roleLabel(args.role as string)})`,
    resultPreview: (r) => {
      const data = r.data as Record<string, unknown> | undefined
      return data?.name ? `已创建：${data.name}` : '角色已创建'
    },
  },

  update_character: {
    argFields: [
      { label: '角色ID', key: 'characterId', type: 'hidden' },
      { label: '姓名', key: 'name', type: 'text' },
      { label: '定位', key: 'role', type: 'badge', transform: (v) => roleLabel(v as string) },
      { label: '外貌', key: 'appearance', type: 'multiline' },
      { label: '性格', key: 'personality', type: 'multiline' },
      { label: '背景', key: 'background', type: 'multiline' },
      { label: '动机', key: 'motivation', type: 'multiline' },
      { label: '成长弧线', key: 'arc', type: 'multiline' },
      { label: '关系', key: 'relationships', type: 'list', transform: (v) => {
        const rels = v as Array<{ characterName: string; relation: string; description?: string }> | undefined
        if (!rels?.length) return ''
        return rels.map(r => `${r.characterName}（${r.relation}）${r.description ? `：${r.description}` : ''}`).join('\n')
      }},
    ],
    resultFields: [
      { label: '姓名', key: 'data.name', type: 'text', transform: (v) => `已更新：${v}` },
    ],
    argPreview: (args) => args.name ? `${args.name} (${roleLabel(args.role as string)})` : '更新角色',
    resultPreview: (r) => {
      const data = r.data as Record<string, unknown> | undefined
      return data?.name ? `已更新：${data.name}` : '角色已更新'
    },
  },

  delete_character: {
    resultFields: [
      { label: '状态', key: 'success', type: 'hidden' },
    ],
    resultPreview: () => '角色已删除',
  },

  get_character: {
    argFields: [
      { label: '角色ID', key: 'characterId', type: 'text' },
    ],
    resultFields: [
      { label: '姓名', key: 'name', type: 'text' },
      { label: '定位', key: 'role', type: 'badge', transform: (v) => roleLabel(v as string) },
      { label: '外貌', key: 'appearance', type: 'multiline' },
      { label: '性格', key: 'personality', type: 'multiline' },
      { label: '背景', key: 'background', type: 'multiline' },
      { label: '动机', key: 'motivation', type: 'multiline' },
      { label: '成长弧线', key: 'arc', type: 'multiline' },
      { label: '关系', key: 'relationships', type: 'list', transform: (v) => {
        const rels = v as Array<{ characterName: string; relation: string; description?: string }> | undefined
        if (!rels?.length) return ''
        return rels.map(r => `${r.characterName}（${r.relation}）`.trim()).join('\n')
      }},
    ],
    resultPreview: (r) => 'name' in r ? `${r.name} (${roleLabel(r.role as string)})` : '',
  },

  list_characters: {
    resultFields: [
      { label: '角色数', key: 'count', type: 'text', transform: (v) => `${v} 位` },
      { label: '角色列表', key: 'characters', type: 'list', transform: (v) => {
        const chars = v as Array<{ name: string; role: string }> | undefined
        if (!chars?.length) return '（暂无角色）'
        return chars.map(c => `${c.name} (${roleLabel(c.role)})`).join('\n')
      }},
    ],
    resultPreview: (r) => `${r.count ?? 0} 位角色`,
  },

  // ── World building ──────────────────────────────────────

  set_world_building: {
    argFields: [
      { label: '时代', key: 'era', type: 'text' },
      { label: '地点', key: 'location', type: 'text' },
      { label: '规则', key: 'rules', type: 'multiline' },
      { label: '文化', key: 'culture', type: 'multiline' },
      { label: '势力', key: 'factions', type: 'tags', transform: (v) => {
        const factions = v as Array<{ name: string }> | undefined
        return factions?.map(f => f.name).join(', ') ?? ''
      }},
      { label: '备注', key: 'notes', type: 'multiline' },
    ],
    resultPreview: () => '世界观已设定',
  },

  get_world_building: {
    resultFields: [
      { label: '时代', key: 'era', type: 'text' },
      { label: '地点', key: 'location', type: 'text' },
      { label: '规则', key: 'rules', type: 'multiline' },
      { label: '文化', key: 'culture', type: 'multiline' },
      { label: '势力', key: 'factions', type: 'tags', transform: (v) => {
        const factions = v as Array<{ name: string }> | undefined
        return factions?.map(f => f.name).join(', ') ?? ''
      }},
      { label: '备注', key: 'notes', type: 'multiline' },
    ],
    resultPreview: (r) => 'era' in r ? `${r.era} · ${r.location}` : '',
  },

  // ── Style ───────────────────────────────────────────────

  set_style: {
    argFields: [
      { label: '叙事视角', key: 'narrativePerspective', type: 'badge', transform: (v) => perspectiveLabel(v as string) },
      { label: '时态', key: 'tense', type: 'badge', transform: (v) => tenseLabel(v as string) },
      { label: '语言风格', key: 'languageStyle', type: 'text' },
    ],
    resultPreview: () => '文风已设定',
  },

  get_style: {
    resultFields: [
      { label: '叙事视角', key: 'narrativePerspective', type: 'badge', transform: (v) => perspectiveLabel(v as string) },
      { label: '时态', key: 'tense', type: 'badge', transform: (v) => tenseLabel(v as string) },
      { label: '语言风格', key: 'languageStyle', type: 'text' },
    ],
    resultPreview: (r) => 'narrativePerspective' in r
      ? `${perspectiveLabel(String(r.narrativePerspective ?? ''))} · ${tenseLabel(String(r.tense ?? ''))}`
      : '',
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
