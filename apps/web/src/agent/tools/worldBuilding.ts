import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import { getWorldBuildingByNovelId, saveWorldBuilding } from '@/db/worldBuilding'
import type { WorldBuilding } from '@/db/types'

export function createWorldBuildingTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'upsert_world_building',
      displayName: 'tools.upsert_world_building.displayName',
      icon: '🌍',
      description: 'tools.upsert_world_building.description',
      parameters: {
        type: 'object',
        properties: {
          era: { type: 'string', description: '时代背景' },
          location: { type: 'string', description: '主要地点' },
          rules: { type: 'string', description: '世界观规则（魔法体系、科技设定等）' },
          culture: { type: 'string', description: '文化背景' },
          notes: { type: 'string', description: '其他备注' },
          factions: {
            type: 'array',
            description: '势力/派系列表（可选，设置后会替换全部已有势力）',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '势力名称' },
                description: { type: 'string', description: '势力描述' },
                goals: { type: 'string', description: '势力目标' },
              },
              required: ['name'],
            },
          },
        },
        required: [],
      },
      validationSchema: z.object({
        era: z.string().optional(),
        location: z.string().optional(),
        rules: z.string().optional(),
        culture: z.string().optional(),
        notes: z.string().optional(),
        factions: z
          .array(
            z.object({
              name: z.string(),
              description: z.string().optional(),
              goals: z.string().optional(),
            }),
          )
          .optional(),
      }),
      async execute(args: Record<string, unknown>) {
        const existing = await getWorldBuildingByNovelId(context.novelId)
        if (existing) {
          if ('era' in args && args.era != null) existing.era = args.era as string
          if ('location' in args && args.location != null)
            existing.location = args.location as string
          if ('rules' in args && args.rules != null) existing.rules = args.rules as string
          if ('culture' in args && args.culture != null) existing.culture = args.culture as string
          if ('notes' in args && args.notes != null) existing.notes = args.notes as string
          if (args.factions) {
            existing.factions = (args.factions as Array<Record<string, unknown>>).map((f) => ({
              name: f.name as string,
              description: (f.description as string) ?? '',
              goals: (f.goals as string) ?? '',
            }))
          }
          existing.updatedAt = Date.now()
          await saveWorldBuilding(existing)
          return { success: true, data: existing }
        }

        if (!args.era && !args.location) {
          return { error: '首次创建世界观时至少需要提供时代背景或主要地点' }
        }

        const wb: WorldBuilding = {
          novelId: context.novelId,
          era: (args.era as string) ?? '',
          location: (args.location as string) ?? '',
          rules: (args.rules as string) ?? '',
          culture: (args.culture as string) ?? '',
          factions: args.factions
            ? (args.factions as Array<Record<string, unknown>>).map((f) => ({
                name: f.name as string,
                description: (f.description as string) ?? '',
                goals: (f.goals as string) ?? '',
              }))
            : [],
          notes: (args.notes as string) ?? '',
          updatedAt: Date.now(),
        }
        await saveWorldBuilding(wb)
        return { success: true, data: wb }
      },
    },
    {
      name: 'get_world_building',
      displayName: 'tools.get_world_building.displayName',
      icon: '🌍',
      description: 'tools.get_world_building.description',
      parameters: { type: 'object', properties: {}, required: [] },
      validationSchema: z.object({}),
      async execute() {
        const wb = await getWorldBuildingByNovelId(context.novelId)
        return wb ?? { error: '世界观设定不存在' }
      },
    },
  ]
}
