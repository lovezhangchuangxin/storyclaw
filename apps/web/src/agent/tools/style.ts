import type { ToolContext, ToolDefinition } from './types'
import { getNovelById, updateNovel } from '@/db/novels'

export function createStyleTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'set_style',
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
      async execute(args: Record<string, unknown>) {
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

        if (args.narrativePerspective)
          novel.styleSettings.narrativePerspective = args.narrativePerspective as string
        if (args.tense) novel.styleSettings.tense = args.tense as string
        if (args.languageStyle) novel.styleSettings.languageStyle = args.languageStyle as string
        novel.updatedAt = Date.now()
        await updateNovel(novel)
        return { success: true, style: novel.styleSettings }
      },
    },
    {
      name: 'apply_style_to_chapter',
      description: '根据已设定的文风偏好，对指定章节进行文风调整。',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '章节序号' },
        },
        required: ['index'],
      },
      async execute(args: Record<string, unknown>) {
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

        const style = novel.styleSettings
        return {
          success: true,
          index: args.index,
          instruction: `请根据以下文风设定调整该章节：叙事视角=${style.narrativePerspective}，时态=${style.tense}，语言风格=${style.languageStyle}`,
        }
      },
    },
  ]
}
