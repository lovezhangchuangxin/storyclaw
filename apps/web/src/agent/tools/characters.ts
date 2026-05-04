import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import {
  getCharactersByNovelId,
  getCharacterById,
  saveCharacter,
  deleteCharacter,
} from '@/db/characters'
import type { Character } from '@/db/types'

export function createCharacterTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'create_character',
      displayName: '创建角色',
      icon: '👤',
      description: '创建新角色。调用此工具来添加角色到故事中。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '角色姓名' },
          role: {
            type: 'string',
            enum: ['protagonist', 'antagonist', 'supporting', 'minor'],
            description: '角色定位',
          },
          appearance: { type: 'string', description: '外貌描述' },
          personality: { type: 'string', description: '性格特征' },
          background: { type: 'string', description: '背景故事' },
          motivation: { type: 'string', description: '动机和目标' },
          arc: { type: 'string', description: '角色成长弧线' },
        },
        required: ['name', 'role', 'personality'],
      },
      validationSchema: z.object({
        name: z.string(),
        role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']),
        appearance: z.string().optional(),
        personality: z.string(),
        background: z.string().optional(),
        motivation: z.string().optional(),
        arc: z.string().optional(),
      }),
      async execute(args: Record<string, unknown>) {
        const character: Character = {
          id: crypto.randomUUID(),
          novelId: context.novelId,
          name: args.name as string,
          role: args.role as Character['role'],
          appearance: (args.appearance as string) ?? '',
          personality: args.personality as string,
          background: (args.background as string) ?? '',
          motivation: (args.motivation as string) ?? '',
          arc: (args.arc as string) ?? '',
          relationships: [],
          updatedAt: Date.now(),
        }
        await saveCharacter(character)
        return { success: true, data: character }
      },
    },
    {
      name: 'update_character',
      displayName: '更新角色',
      icon: '👤',
      description: '修改已有角色的信息。',
      parameters: {
        type: 'object',
        properties: {
          characterId: { type: 'string', description: '角色ID' },
          name: { type: 'string', description: '姓名（可选）' },
          role: { type: 'string', enum: ['protagonist', 'antagonist', 'supporting', 'minor'] },
          appearance: { type: 'string' },
          personality: { type: 'string' },
          background: { type: 'string' },
          motivation: { type: 'string' },
          arc: { type: 'string' },
          relationships: {
            type: 'array',
            description: '角色关系列表（可选，设置后会替换全部已有关系）',
            items: {
              type: 'object',
              properties: {
                characterId: { type: 'string', description: '目标角色ID' },
                characterName: { type: 'string', description: '目标角色姓名' },
                relation: { type: 'string', description: '关系类型（如：挚友、宿敌、师徒）' },
                description: { type: 'string', description: '关系描述' },
              },
              required: ['characterId', 'characterName', 'relation'],
            },
          },
        },
        required: ['characterId'],
      },
      validationSchema: z.object({
        characterId: z.string(),
        name: z.string().optional(),
        role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']).optional(),
        appearance: z.string().optional(),
        personality: z.string().optional(),
        background: z.string().optional(),
        motivation: z.string().optional(),
        arc: z.string().optional(),
        relationships: z
          .array(
            z.object({
              characterId: z.string(),
              characterName: z.string(),
              relation: z.string(),
              description: z.string().optional(),
            }),
          )
          .optional(),
      }),
      async execute(args: Record<string, unknown>) {
        const existing = await getCharacterById(context.novelId, args.characterId as string)
        if (!existing) return { error: '角色不存在' }

        if ('name' in args) existing.name = args.name as string
        if ('role' in args) existing.role = args.role as Character['role']
        if ('appearance' in args) existing.appearance = args.appearance as string
        if ('personality' in args) existing.personality = args.personality as string
        if ('background' in args) existing.background = args.background as string
        if ('motivation' in args) existing.motivation = args.motivation as string
        if ('arc' in args) existing.arc = args.arc as string

        if (args.relationships) {
          existing.relationships = (args.relationships as Array<Record<string, unknown>>).map(
            (r) => ({
              characterId: r.characterId as string,
              characterName: r.characterName as string,
              relation: r.relation as string,
              description: (r.description as string) ?? '',
            }),
          )
        }

        existing.updatedAt = Date.now()
        await saveCharacter(existing)
        return { success: true, data: existing }
      },
    },
    {
      name: 'delete_character',
      displayName: '删除角色',
      icon: '👤',
      description: '从故事中删除角色。',
      parameters: {
        type: 'object',
        properties: { characterId: { type: 'string', description: '角色ID' } },
        required: ['characterId'],
      },
      validationSchema: z.object({
        characterId: z.string(),
      }),
      async execute(args: Record<string, unknown>) {
        await deleteCharacter(context.novelId, args.characterId as string)
        return { success: true }
      },
    },
    {
      name: 'get_character',
      displayName: '获取角色',
      icon: '👤',
      description: '获取指定角色的详细信息。',
      parameters: {
        type: 'object',
        properties: { characterId: { type: 'string' } },
        required: ['characterId'],
      },
      validationSchema: z.object({
        characterId: z.string(),
      }),
      async execute(args: Record<string, unknown>) {
        const character = await getCharacterById(context.novelId, args.characterId as string)
        return character ?? { error: '角色不存在' }
      },
    },
    {
      name: 'list_characters',
      displayName: '列出角色',
      icon: '👤',
      description: '列出当前故事的所有角色。',
      parameters: { type: 'object', properties: {}, required: [] },
      validationSchema: z.object({}),
      async execute() {
        const characters = await getCharactersByNovelId(context.novelId)
        return { count: characters.length, characters }
      },
    },
  ]
}
