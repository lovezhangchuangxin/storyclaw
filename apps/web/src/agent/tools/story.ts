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
      description: '创建一个新故事。用户描述故事想法后，调用此工具来在系统中创建故事。创建完成后可以使用 generate_title 和 generate_synopsis 来完善信息。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '故事标题' },
          synopsis: { type: 'string', description: '故事简介' },
        },
        required: ['title', 'synopsis'],
      },
      async execute(args: Record<string, unknown>) {
        const existing = await getNovelById(context.novelId)
        if (existing) return { success: true, id: existing.id, title: existing.title }

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
      description: '获取当前故事的整体状态，包括进度、章节完成情况、角色数量等。',
      parameters: { type: 'object', properties: {}, required: [] },
      async execute() {
        const novel = await getNovelById(context.novelId)
        if (!novel) return { error: '小说不存在' }

        const chapters = await getChaptersByNovelId(context.novelId)
        const characters = await getCharactersByNovelId(context.novelId)
        const outline = await getOutlineByNovelId(context.novelId)

        return {
          id: novel.id,
          title: novel.title,
          status: novel.status,
          currentWordCount: novel.currentWordCount,
          targetWordCount: novel.targetWordCount,
          totalChapters: chapters.length,
          completedChapters: chapters.filter((c) => c.status === 'completed').length,
          characterCount: characters.length,
          hasOutline: !!outline,
        }
      },
    },
    {
      name: 'generate_title',
      description: '根据故事内容生成标题，并更新小说标题。',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: '新标题' } },
        required: ['title'],
      },
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
      description: '根据故事内容生成简介，并更新小说简介。',
      parameters: {
        type: 'object',
        properties: { synopsis: { type: 'string', description: '故事简介' } },
        required: ['synopsis'],
      },
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
