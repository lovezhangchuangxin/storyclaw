import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import { getChapterByIndex, getChaptersByNovelId, saveChapter, deleteChapter } from '@/db/chapters'
import { getNovelById, updateNovel } from '@/db/novels'
import { getOutlineByNovelId, saveOutline } from '@/db/outlines'
import type { Chapter } from '@/db/types'

/** Recalculate novel.currentWordCount from all chapters and persist it. */
async function syncNovelWordCount(novelId: string): Promise<void> {
  const novel = await getNovelById(novelId)
  if (!novel) return
  const chapters = await getChaptersByNovelId(novelId)
  novel.currentWordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0)
  novel.updatedAt = Date.now()
  await updateNovel(novel)
}

export function createChapterTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'plan_chapters',
      displayName: 'tools.plan_chapters.displayName',
      icon: '📋',
      description: 'tools.plan_chapters.description',
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
      validationSchema: z.object({
        chapters: z.array(
          z.object({
            title: z.string(),
            summary: z.string(),
            estimatedWordCount: z.number(),
            pointOfView: z.string().optional(),
          }),
        ),
      }),
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

        // Fetch existing chapters to preserve already-written content.
        const existing = await getChaptersByNovelId(context.novelId)
        const existingMap = new Map(existing.map((ch) => [ch.index, ch]))

        await Promise.all(
          chapterPlans.map((plan) => {
            const prev = existingMap.get(plan.index)
            const chapter: Chapter = prev
              ? {
                  ...prev,
                  title: plan.title,
                  summary: plan.summary,
                  pointOfView: plan.pointOfView,
                  updatedAt: Date.now(),
                }
              : {
                  novelId: context.novelId,
                  index: plan.index,
                  title: plan.title,
                  summary: plan.summary,
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

        // Remove stale chapters beyond the new plan range
        const maxIndex = chapterPlans.length - 1
        const stale = existing.filter((ch) => ch.index > maxIndex)
        if (stale.length > 0) {
          await Promise.all(stale.map((ch) => deleteChapter(context.novelId, ch.index)))
        }

        if (outline) {
          outline.chapterPlan = chapterPlans
          outline.updatedAt = Date.now()
          await saveOutline(outline)
        }

        return { success: true, count: chapterPlans.length, chapters: chapterPlans }
      },
    },
    {
      name: 'write_chapter',
      displayName: 'tools.write_chapter.displayName',
      icon: '✍️',
      description: 'tools.write_chapter.description',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '章节序号（从0开始）' },
          content: { type: 'string', description: '章节正文，纯文本格式' },
        },
        required: ['index', 'content'],
      },
      validationSchema: z.object({
        index: z.number(),
        content: z.string(),
      }),
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
        await syncNovelWordCount(context.novelId)
        return { success: true, index, wordCount: existing.wordCount }
      },
    },
    {
      name: 'rewrite_chapter',
      displayName: 'tools.rewrite_chapter.displayName',
      icon: '✍️',
      description: 'tools.rewrite_chapter.description',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '章节序号' },
          content: { type: 'string', description: '重写后的章节内容，纯文本格式' },
        },
        required: ['index', 'content'],
      },
      validationSchema: z.object({
        index: z.number(),
        content: z.string(),
      }),
      async execute(args: Record<string, unknown>) {
        const index = args.index as number
        const existing = await getChapterByIndex(context.novelId, index)
        if (!existing) return { error: '章节不存在' }

        existing.content = args.content as string
        existing.wordCount = (args.content as string).length
        existing.status = 'completed'
        existing.updatedAt = Date.now()
        await saveChapter(existing)
        await syncNovelWordCount(context.novelId)
        return { success: true, index, wordCount: existing.wordCount }
      },
    },
    {
      name: 'get_chapter',
      displayName: 'tools.get_chapter.displayName',
      icon: '📋',
      description: 'tools.get_chapter.description',
      parameters: {
        type: 'object',
        properties: { index: { type: 'number' } },
        required: ['index'],
      },
      validationSchema: z.object({
        index: z.number(),
      }),
      async execute(args: Record<string, unknown>) {
        const chapter = await getChapterByIndex(context.novelId, args.index as number)
        return chapter ?? { error: '章节不存在' }
      },
    },
  ]
}
