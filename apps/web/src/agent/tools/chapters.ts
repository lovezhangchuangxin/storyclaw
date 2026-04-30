import type { ToolContext, ToolDefinition } from './types'
import { getChapterByIndex, saveChapter } from '@/db/chapters'
import { getOutlineByNovelId, saveOutline } from '@/db/outlines'
import type { Chapter } from '@/db/types'

export function createChapterTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'plan_chapters',
      description: '根据大纲规划章节划分和各章节概要。在大纲确定后调用。',
      parameters: {
        type: 'object',
        properties: {
          chapters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                estimatedWordCount: { type: 'number' },
                pointOfView: { type: 'string' },
              },
              required: ['title', 'summary', 'estimatedWordCount'],
            },
          },
        },
        required: ['chapters'],
      },
      async execute(args: Record<string, unknown>) {
        const chapters = args.chapters as Array<Record<string, unknown>>
        const outline = await getOutlineByNovelId(context.novelId)

        const chapterPlans = chapters.map((c, i) => ({
          index: i,
          title: c.title as string,
          summary: c.summary as string,
          estimatedWordCount: c.estimatedWordCount as number,
          pointOfView: (c.pointOfView as string) ?? '',
          status: 'planned' as const,
        }))

        if (outline) {
          outline.chapterPlan = chapterPlans
          outline.updatedAt = Date.now()
          await saveOutline(outline)
        }

        await Promise.all(
          chapterPlans.map((plan) => {
            const chapter: Chapter = {
              novelId: context.novelId,
              index: plan.index,
              title: plan.title,
              content: '',
              wordCount: 0,
              status: 'planned',
              pointOfView: plan.pointOfView,
              scenes: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
            return saveChapter(chapter)
          }),
        )

        return { success: true, count: chapterPlans.length, chapters: chapterPlans }
      },
    },
    {
      name: 'write_chapter',
      description: '创作指定章节的内容。这是流式输出，用户将看到内容逐步生成。',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '章节序号（从0开始）' },
          content: { type: 'string', description: '章节正文，Markdown格式' },
        },
        required: ['index', 'content'],
      },
      async execute(args: Record<string, unknown>) {
        const index = args.index as number
        const content = args.content as string
        const existing = await getChapterByIndex(context.novelId, index)
        if (!existing) return { error: '章节不存在，请先调用 plan_chapters' }

        existing.content = content
        existing.wordCount = content.length
        existing.status = 'completed'
        existing.updatedAt = Date.now()
        await saveChapter(existing)
        return { success: true, index, wordCount: existing.wordCount }
      },
    },
    {
      name: 'rewrite_chapter',
      description: '根据用户反馈重写指定章节。',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '章节序号' },
          content: { type: 'string', description: '重写后的章节内容' },
        },
        required: ['index', 'content'],
      },
      async execute(args: Record<string, unknown>) {
        const index = args.index as number
        const existing = await getChapterByIndex(context.novelId, index)
        if (!existing) return { error: '章节不存在' }

        existing.content = args.content as string
        existing.wordCount = (args.content as string).length
        existing.updatedAt = Date.now()
        await saveChapter(existing)
        return { success: true, index, wordCount: existing.wordCount }
      },
    },
    {
      name: 'get_chapter',
      description: '获取指定章节的完整内容。',
      parameters: {
        type: 'object',
        properties: { index: { type: 'number' } },
        required: ['index'],
      },
      async execute(args: Record<string, unknown>) {
        const chapter = await getChapterByIndex(context.novelId, args.index as number)
        return chapter ?? { error: '章节不存在' }
      },
    },
  ]
}
