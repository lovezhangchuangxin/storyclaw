import type { ToolContext, ToolDefinition } from './types'
import { getNovelById, updateNovel } from '@/db/novels'
import { getChaptersByNovelId } from '@/db/chapters'
import { getCharactersByNovelId } from '@/db/characters'
import { getOutlineByNovelId } from '@/db/outlines'

export function createStoryManagementTools(context: ToolContext): ToolDefinition[] {
  return [
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
