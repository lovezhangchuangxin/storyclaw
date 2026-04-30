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
        },
        required: ['characterId'],
      },
      async execute(args: Record<string, unknown>) {
        const existing = await getCharacterById(context.novelId, args.characterId as string)
        if (!existing) return { error: '角色不存在' }

        Object.assign(existing, args)
        existing.updatedAt = Date.now()
        await saveCharacter(existing)
        return { success: true, data: existing }
      },
    },
    {
      name: 'delete_character',
      description: '从故事中删除角色。',
      parameters: {
        type: 'object',
        properties: { characterId: { type: 'string', description: '角色ID' } },
        required: ['characterId'],
      },
      async execute(args: Record<string, unknown>) {
        await deleteCharacter(context.novelId, args.characterId as string)
        return { success: true }
      },
    },
    {
      name: 'get_character',
      description: '获取指定角色的详细信息。',
      parameters: {
        type: 'object',
        properties: { characterId: { type: 'string' } },
        required: ['characterId'],
      },
      async execute(args: Record<string, unknown>) {
        const character = await getCharacterById(context.novelId, args.characterId as string)
        return character ?? { error: '角色不存在' }
      },
    },
    {
      name: 'list_characters',
      description: '列出当前故事的所有角色。',
      parameters: { type: 'object', properties: {}, required: [] },
      async execute() {
        const characters = await getCharactersByNovelId(context.novelId)
        return { count: characters.length, characters }
      },
    },
  ]
}
