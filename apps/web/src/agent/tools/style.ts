import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import { getNovelById, updateNovel } from '@/db/novels'
import { getChapterByIndex } from '@/db/chapters'

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
      displayName: '应用文风',
      icon: '🎨',
      description: '根据已设定的文风偏好，对指定章节进行文风调整。',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '章节序号' },
        },
        required: ['index'],
      },
      validationSchema: z.object({
        index: z.number(),
      }),
      async execute(args: Record<string, unknown>) {
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

        const index = args.index as number
        const chapter = await getChapterByIndex(context.novelId, index)
        if (!chapter) return { error: '章节不存在，请先调用 plan_chapters' }

        const style = novel.styleSettings
        return {
          success: true,
          chapter: {
            index: chapter.index,
            title: chapter.title,
            wordCount: chapter.wordCount,
            content: chapter.content,
          },
          styleSettings: style,
          instruction: `请根据以上章节内容和文风设定，重写第 ${index} 章「${chapter.title}」：叙事视角=${style.narrativePerspective || '未指定'}，时态=${style.tense || '未指定'}，语言风格=${style.languageStyle || '未指定'}。请调用 rewrite_chapter 工具提交重写后的完整内容。`,
        }
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
