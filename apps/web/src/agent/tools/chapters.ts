import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import { getChapterByIndex, getChaptersByNovelId, saveChapter, deleteChapter } from '@/db/chapters'
import { getNovelById, updateNovel } from '@/db/novels'
import { getOutlineByNovelId, saveOutline } from '@/db/outlines'
import type { Chapter } from '@/db/types'

/** Recalculate novel.currentWordCount from non-archived chapters and persist it. */
async function syncNovelWordCount(novelId: string): Promise<void> {
  const novel = await getNovelById(novelId)
  if (!novel) {
    console.warn(`[syncNovelWordCount] Novel not found: ${novelId}`)
    return
  }
  const chapters = await getChaptersByNovelId(novelId)
  novel.currentWordCount = chapters
    .filter((ch) => ch.status !== 'archived')
    .reduce((sum, ch) => sum + ch.wordCount, 0)
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
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

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
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                }
            return saveChapter(chapter)
          }),
        )

        // Archive chapters beyond the new plan range (instead of deleting)
        const maxIndex = chapterPlans.length - 1
        const stale = existing.filter((ch) => ch.index > maxIndex && ch.status !== 'archived')
        if (stale.length > 0) {
          await Promise.all(
            stale.map((ch) => {
              ch.status = 'archived'
              ch.updatedAt = Date.now()
              return saveChapter(ch)
            }),
          )
          await syncNovelWordCount(context.novelId)
        }

        if (outline) {
          outline.chapterPlan = chapterPlans
          outline.updatedAt = Date.now()
          await saveOutline(outline)
        }

        const result: Record<string, unknown> = {
          success: true,
          count: chapterPlans.length,
          chapters: chapterPlans,
        }
        if (stale.length > 0) {
          result.archivedChapters = stale.map((ch) => ({
            index: ch.index,
            title: ch.title,
            wordCount: ch.wordCount,
          }))
          result.warning = `以下 ${stale.length} 个章节已被归档：${stale.map((ch) => `第${ch.index + 1}章「${ch.title}」`).join('、')}`
        }
        return result
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
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

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
    {
      name: 'list_chapters',
      displayName: 'tools.list_chapters.displayName',
      icon: '📋',
      description: 'tools.list_chapters.description',
      parameters: { type: 'object', properties: {}, required: [] },
      validationSchema: z.object({}),
      async execute() {
        const chapters = await getChaptersByNovelId(context.novelId)
        const sorted = chapters.slice().sort((a, b) => a.index - b.index)
        return {
          count: sorted.length,
          chapters: sorted.map((ch) => ({
            index: ch.index,
            title: ch.title,
            status: ch.status,
            wordCount: ch.wordCount,
            pointOfView: ch.pointOfView ?? '',
          })),
        }
      },
    },
    {
      name: 'delete_chapter',
      displayName: 'tools.delete_chapter.displayName',
      icon: '🗑️',
      description: 'tools.delete_chapter.description',
      parameters: {
        type: 'object',
        properties: { index: { type: 'number', description: '章节序号（从0开始）' } },
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
        if (!chapter) return { error: '章节不存在' }
        await deleteChapter(context.novelId, index)
        await syncNovelWordCount(context.novelId)
        return { success: true, deletedIndex: index, title: chapter.title }
      },
    },
    {
      name: 'search_content',
      displayName: 'tools.search_content.displayName',
      icon: '🔍',
      description: 'tools.search_content.description',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词' },
        },
        required: ['query'],
      },
      validationSchema: z.object({
        query: z.string().min(1),
      }),
      async execute(args: Record<string, unknown>) {
        const chapters = await getChaptersByNovelId(context.novelId)
        const query = (args.query as string).toLowerCase()
        const results = chapters
          .filter((ch) => ch.content && ch.content.toLowerCase().includes(query))
          .map((ch) => {
            const idx = ch.content!.toLowerCase().indexOf(query)
            const start = Math.max(0, idx - 50)
            const end = Math.min(ch.content!.length, idx + query.length + 50)
            return {
              index: ch.index,
              title: ch.title,
              status: ch.status,
              snippet:
                (start > 0 ? '...' : '') +
                ch.content!.slice(start, end) +
                (end < ch.content!.length ? '...' : ''),
            }
          })
        return { query: args.query, matchCount: results.length, results }
      },
    },
  ]
}
