import type { ToolContext, ToolDefinition } from './types'
import { getOutlineByNovelId, saveOutline } from '@/db/outlines'

export function createOutlineTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'create_outline',
      description: '创建故事大纲，包含标题、梗概和三幕结构。在首次设计大纲时调用。',
      parameters: {
        type: 'object',
        properties: {
          premise: { type: 'string', description: '故事一句话前提' },
          act1: { type: 'string', description: '第一幕（建置）：介绍世界观、主要角色和核心冲突' },
          act2: { type: 'string', description: '第二幕（对抗）：冲突升级，角色面临挑战和转折' },
          act3: { type: 'string', description: '第三幕（解决）：高潮和结局' },
        },
        required: ['premise', 'act1', 'act2', 'act3'],
      },
      async execute(args: Record<string, unknown>) {
        const outline = {
          novelId: context.novelId,
          premise: args.premise as string,
          threeActs: {
            act1: { summary: args.act1 as string, keyEvents: [], characterArcs: [] },
            act2: { summary: args.act2 as string, keyEvents: [], characterArcs: [] },
            act3: { summary: args.act3 as string, keyEvents: [], characterArcs: [] },
          },
          chapterPlan: [],
          updatedAt: Date.now(),
        }
        await saveOutline(outline)
        return { success: true, data: outline }
      },
    },
    {
      name: 'update_outline',
      description: '修改已有的大纲内容，可以更新某一幕或整体前提。',
      parameters: {
        type: 'object',
        properties: {
          premise: { type: 'string', description: '更新后的故事前提（可选）' },
          act1: { type: 'string', description: '更新后的第一幕内容（可选）' },
          act2: { type: 'string', description: '更新后的第二幕内容（可选）' },
          act3: { type: 'string', description: '更新后的第三幕内容（可选）' },
        },
        required: [],
      },
      async execute(args: Record<string, unknown>) {
        const existing = await getOutlineByNovelId(context.novelId)
        if (!existing) return { error: '没有找到大纲，请先调用 create_outline' }

        if (args.premise) existing.premise = args.premise as string
        if (args.act1) existing.threeActs.act1.summary = args.act1 as string
        if (args.act2) existing.threeActs.act2.summary = args.act2 as string
        if (args.act3) existing.threeActs.act3.summary = args.act3 as string
        existing.updatedAt = Date.now()

        await saveOutline(existing)
        return { success: true, data: existing }
      },
    },
    {
      name: 'get_outline',
      description: '获取当前故事的大纲。',
      parameters: { type: 'object', properties: {}, required: [] },
      async execute() {
        const outline = await getOutlineByNovelId(context.novelId)
        return outline ?? { error: '没有找到大纲' }
      },
    },
  ]
}
