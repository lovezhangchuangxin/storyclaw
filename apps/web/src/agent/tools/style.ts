import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import { getNovelById, updateNovel } from '@/db/novels'

export function createStyleTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'set_style',
      displayName: '设定文风',
      icon: '🎨',
      description: '设定文风偏好，包括叙事视角、时态、语言风格等。',
      parameters: {
        type: 'object',
        properties: {
          narrativePerspective: {
            type: 'string',
            enum: ['first-person', 'third-person-limited', 'third-person-omniscient'],
            description: '叙事视角',
          },
          tense: { type: 'string', enum: ['past', 'present'], description: '时态' },
          languageStyle: { type: 'string', description: '语言风格，如简洁、华丽、口语化、文艺等' },
        },
        required: [],
      },
      validationSchema: z.object({
        narrativePerspective: z
          .enum(['first-person', 'third-person-limited', 'third-person-omniscient'])
          .optional(),
        tense: z.enum(['past', 'present']).optional(),
        languageStyle: z.string().optional(),
      }),
      async execute(args: Record<string, unknown>) {
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

        if ('narrativePerspective' in args)
          novel.styleSettings.narrativePerspective = args.narrativePerspective as string
        if ('tense' in args) novel.styleSettings.tense = args.tense as string
        if ('languageStyle' in args)
          novel.styleSettings.languageStyle = args.languageStyle as string
        novel.updatedAt = Date.now()
        await updateNovel(novel)
        return { success: true, style: novel.styleSettings }
      },
    },
    {
      name: 'get_style',
      displayName: '获取文风',
      icon: '🎨',
      description: '获取当前故事的文风设定，包括叙事视角、时态、语言风格等。',
      parameters: { type: 'object', properties: {}, required: [] },
      validationSchema: z.object({}),
      async execute() {
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }
        return novel.styleSettings
      },
    },
  ]
}
