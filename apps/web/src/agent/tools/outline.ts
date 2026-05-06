import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import { getOutlineByNovelId, saveOutline } from '@/db/outlines'

export function createOutlineTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'create_outline',
      displayName: 'tools.create_outline.displayName',
      icon: '📖',
      description: 'tools.create_outline.description',
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
      validationSchema: z.object({
        premise: z.string(),
        act1: z.string(),
        act2: z.string(),
        act3: z.string(),
      }),
      async execute(args: Record<string, unknown>) {
        const existing = await getOutlineByNovelId(context.novelId)
        if (existing) {
          existing.premise = args.premise as string
          existing.threeActs.act1.summary = args.act1 as string
          existing.threeActs.act2.summary = args.act2 as string
          existing.threeActs.act3.summary = args.act3 as string
          existing.updatedAt = Date.now()
          await saveOutline(existing)
          return { success: true, data: existing }
        }

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
      displayName: 'tools.update_outline.displayName',
      icon: '📖',
      description: 'tools.update_outline.description',
      parameters: {
        type: 'object',
        properties: {
          premise: { type: 'string', description: '更新后的故事前提（可选）' },
          act1: { type: 'string', description: '更新后的第一幕内容（可选）' },
          act2: { type: 'string', description: '更新后的第二幕内容（可选）' },
          act3: { type: 'string', description: '更新后的第三幕内容（可选）' },
          act1_keyEvents: {
            type: 'array',
            items: { type: 'string' },
            description: '第一幕关键事件列表（可选，设置后会替换全部已有事件）',
          },
          act1_characterArcs: {
            type: 'array',
            items: { type: 'string' },
            description: '第一幕角色弧线列表（可选）',
          },
          act2_keyEvents: {
            type: 'array',
            items: { type: 'string' },
            description: '第二幕关键事件列表（可选）',
          },
          act2_characterArcs: {
            type: 'array',
            items: { type: 'string' },
            description: '第二幕角色弧线列表（可选）',
          },
          act3_keyEvents: {
            type: 'array',
            items: { type: 'string' },
            description: '第三幕关键事件列表（可选）',
          },
          act3_characterArcs: {
            type: 'array',
            items: { type: 'string' },
            description: '第三幕角色弧线列表（可选）',
          },
        },
        required: [],
      },
      validationSchema: z.object({
        premise: z.string().optional(),
        act1: z.string().optional(),
        act2: z.string().optional(),
        act3: z.string().optional(),
        act1_keyEvents: z.array(z.string()).optional(),
        act1_characterArcs: z.array(z.string()).optional(),
        act2_keyEvents: z.array(z.string()).optional(),
        act2_characterArcs: z.array(z.string()).optional(),
        act3_keyEvents: z.array(z.string()).optional(),
        act3_characterArcs: z.array(z.string()).optional(),
      }),
      async execute(args: Record<string, unknown>) {
        const existing = await getOutlineByNovelId(context.novelId)
        if (!existing) return { error: '没有找到大纲，请先调用 create_outline' }

        if ('premise' in args) existing.premise = args.premise as string
        if ('act1' in args) existing.threeActs.act1.summary = args.act1 as string
        if ('act2' in args) existing.threeActs.act2.summary = args.act2 as string
        if ('act3' in args) existing.threeActs.act3.summary = args.act3 as string
        if (args.act1_keyEvents) existing.threeActs.act1.keyEvents = args.act1_keyEvents as string[]
        if (args.act1_characterArcs)
          existing.threeActs.act1.characterArcs = args.act1_characterArcs as string[]
        if (args.act2_keyEvents) existing.threeActs.act2.keyEvents = args.act2_keyEvents as string[]
        if (args.act2_characterArcs)
          existing.threeActs.act2.characterArcs = args.act2_characterArcs as string[]
        if (args.act3_keyEvents) existing.threeActs.act3.keyEvents = args.act3_keyEvents as string[]
        if (args.act3_characterArcs)
          existing.threeActs.act3.characterArcs = args.act3_characterArcs as string[]
        existing.updatedAt = Date.now()

        await saveOutline(existing)
        return { success: true, data: existing }
      },
    },
    {
      name: 'get_outline',
      displayName: 'tools.get_outline.displayName',
      icon: '📖',
      description: 'tools.get_outline.description',
      parameters: { type: 'object', properties: {}, required: [] },
      validationSchema: z.object({}),
      async execute() {
        const outline = await getOutlineByNovelId(context.novelId)
        return outline ?? { error: '没有找到大纲' }
      },
    },
  ]
}
