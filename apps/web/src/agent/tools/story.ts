import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import { getNovelById, updateNovel, createNovel } from '@/db/novels'
import { getChaptersByNovelId } from '@/db/chapters'
import { getCharactersByNovelId } from '@/db/characters'
import { getOutlineByNovelId } from '@/db/outlines'
import type { Novel } from '@/db/types'

export function createStoryManagementTools(context: ToolContext): ToolDefinition[] {
  return [
    {
      name: 'create_story',
      displayName: '创建故事',
      icon: '📚',
      description:
        '创建一个新故事。用户描述故事想法后，调用此工具来在系统中创建故事。创建完成后可以使用 generate_title 和 generate_synopsis 来完善信息。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '故事标题' },
          synopsis: { type: 'string', description: '故事简介' },
        },
        required: ['title', 'synopsis'],
      },
      validationSchema: z.object({
        title: z.string(),
        synopsis: z.string(),
      }),
      async execute(args: Record<string, unknown>) {
        const existing = await getNovelById(context.novelId)
        if (existing) {
          const changed =
            (args.title && args.title !== existing.title) ||
            (args.synopsis && args.synopsis !== existing.synopsis)
          if (changed) {
            if (args.title) existing.title = args.title as string
            if (args.synopsis) existing.synopsis = args.synopsis as string
            existing.updatedAt = Date.now()
            await updateNovel(existing)
          }
          return { success: true, id: existing.id, title: existing.title }
        }

        const novel: Novel = {
          id: context.novelId,
          title: (args.title as string) || '未命名故事',
          synopsis: (args.synopsis as string) || '',
          genre: '',
          targetWordCount: 0,
          currentWordCount: 0,
          status: 'drafting',
          styleSettings: { narrativePerspective: '', tense: '', languageStyle: '' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        }
        await createNovel(novel)
        return { success: true, id: novel.id, title: novel.title }
      },
    },
    {
      name: 'get_story_status',
      displayName: '获取故事状态',
      icon: '📚',
      description: '获取当前故事的整体状态，包括进度、章节完成情况、角色数量等。',
      parameters: { type: 'object', properties: {}, required: [] },
      validationSchema: z.object({}),
      async execute() {
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

        const chapters = await getChaptersByNovelId(context.novelId)
        const characters = await getCharactersByNovelId(context.novelId)
        const outline = await getOutlineByNovelId(context.novelId)

        return {
          id: novel.id,
          title: novel.title,
          synopsis: novel.synopsis,
          status: novel.status,
          currentWordCount: novel.currentWordCount,
          targetWordCount: novel.targetWordCount,
          totalChapters: chapters.length,
          completedChapters: chapters.filter((c) => c.status === 'completed').length,
          characterCount: characters.length,
          hasOutline: !!outline,
          styleSettings: novel.styleSettings,
        }
      },
    },
    {
      name: 'generate_title',
      displayName: '生成标题',
      icon: '🏷️',
      description: '根据故事内容生成标题，并更新小说标题。',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: '新标题' } },
        required: ['title'],
      },
      validationSchema: z.object({
        title: z.string(),
      }),
      async execute(args: Record<string, unknown>) {
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

        novel.title = args.title as string
        novel.updatedAt = Date.now()
        await updateNovel(novel)
        return { success: true, title: novel.title }
      },
    },
    {
      name: 'generate_synopsis',
      displayName: '生成简介',
      icon: '🏷️',
      description: '根据故事内容生成简介，并更新小说简介。',
      parameters: {
        type: 'object',
        properties: { synopsis: { type: 'string', description: '故事简介' } },
        required: ['synopsis'],
      },
      validationSchema: z.object({
        synopsis: z.string(),
      }),
      async execute(args: Record<string, unknown>) {
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

        novel.synopsis = args.synopsis as string
        novel.updatedAt = Date.now()
        await updateNovel(novel)
        return { success: true, synopsis: novel.synopsis }
      },
    },
  ]
}
