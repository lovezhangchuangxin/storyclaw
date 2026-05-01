import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import { getWorldBuildingByNovelId, saveWorldBuilding } from '@/db/worldBuilding'
import type { WorldBuilding } from '@/db/types'

export function createWorldBuildingTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'set_world_building',
      displayName: '设定世界观',
      icon: '🌍',
      description: '设定故事的世界观，包括时代背景、地点、规则、文化等。',
      parameters: {
        type: 'object',
        properties: {
          era: { type: 'string', description: '时代背景' },
          location: { type: 'string', description: '主要地点' },
          rules: { type: 'string', description: '世界观规则（魔法体系、科技设定等）' },
          culture: { type: 'string', description: '文化背景' },
          notes: { type: 'string', description: '其他备注' },
        },
        required: ['era', 'location'],
      },
      validationSchema: z.object({
        era: z.string(),
        location: z.string(),
        rules: z.string().optional(),
        culture: z.string().optional(),
        notes: z.string().optional(),
      }),
      async execute(args: Record<string, unknown>) {
        const wb: WorldBuilding = {
          novelId: context.novelId,
          era: args.era as string,
          location: args.location as string,
          rules: (args.rules as string) ?? '',
          culture: (args.culture as string) ?? '',
          factions: [],
          notes: (args.notes as string) ?? '',
          updatedAt: Date.now(),
        }
        await saveWorldBuilding(wb)
        return { success: true, data: wb }
      },
    },
    {
      name: 'get_world_building',
      displayName: '获取世界观',
      icon: '🌍',
      description: '获取当前故事的世界观设定。',
      parameters: { type: 'object', properties: {}, required: [] },
      validationSchema: z.object({}),
      async execute() {
        const wb = await getWorldBuildingByNovelId(context.novelId)
        return wb ?? { error: '世界观设定不存在' }
      },
    },
  ]
}
