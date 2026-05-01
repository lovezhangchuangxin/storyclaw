<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useDark } from '@vueuse/core'
import { Send, Square, ChevronDown, Loader2 } from 'lucide-vue-next'
import MarkdownRender, { getMarkdown, parseMarkdownToStructure } from 'markstream-vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { runAgentLoop } from '@/agent/loop'
import { getConfig } from '@/db/config'
import { getConversationByNovelId } from '@/db/conversations'
import { modelLabel } from '@/lib/model-utils'
import type { Message, ModelConfig } from '@/db/types'

const props = defineProps<{
  novelId: string
}>()

const input = ref('')
const messages = ref<Message[]>([])
const isGenerating = ref(false)
const streamingContent = ref('')
const abortController = ref<AbortController | null>(null)

const toolStatus = ref('')
const streamingToolName = ref('')
const streamingToolContent = ref('')

const models = ref<ModelConfig[]>([])
const selectedModelId = ref('')

const selectedModelLabel = computed(() => {
  const m = models.value.find((m) => m.id === selectedModelId.value)
  return m ? modelLabel(m) : '选择模型'
})

const isDark = useDark()

const md = getMarkdown('agent-chat')

const streamingNodes = computed(() => {
  if (!streamingContent.value) return []
  return parseMarkdownToStructure(streamingContent.value, md, { final: false })
})

async function loadModels() {
  const config = await getConfig()
  models.value = config.models
  selectedModelId.value = config.defaultModelId || config.models[0]?.id || ''
}

onMounted(async () => {
  await loadModels()
  const conv = await getConversationByNovelId(props.novelId)
  if (conv?.messages) {
    messages.value = conv.messages
  }
})

function pushMessage(msg: Message) {
  messages.value.push(msg)
}

let scrollRAF = 0
function scrollToBottom() {
  cancelAnimationFrame(scrollRAF)
  scrollRAF = requestAnimationFrame(() => {
    nextTick(() => {
      const el = document.getElementById('chat-bottom')
      el?.scrollIntoView({ behavior: 'smooth' })
    })
  })
}

function getToolDisplayName(name: string): string {
  const names: Record<string, string> = {
    create_outline: '创建大纲',
    update_outline: '更新大纲',
    get_outline: '获取大纲',
    create_character: '创建角色',
    update_character: '更新角色',
    delete_character: '删除角色',
    get_character: '获取角色',
    list_characters: '列出角色',
    plan_chapters: '规划章节',
    write_chapter: '创作章节',
    rewrite_chapter: '重写章节',
    get_chapter: '获取章节',
    set_world_building: '设定世界观',
    get_world_building: '获取世界观',
    set_style: '设定文风',
    apply_style_to_chapter: '应用文风',
    create_story: '创建故事',
    get_story_status: '获取故事状态',
    generate_title: '生成标题',
    generate_synopsis: '生成简介',
  }
  return names[name] ?? name
}

// ---- Tool display helpers ----

const toolIconMap: Record<string, string> = {
  write_chapter: '✍️', rewrite_chapter: '✍️',
  plan_chapters: '📋', get_chapter: '📋',
  create_character: '👤', update_character: '👤', delete_character: '👤',
  get_character: '👤', list_characters: '👤',
  create_outline: '📖', update_outline: '📖', get_outline: '📖',
  set_world_building: '🌍', get_world_building: '🌍',
  set_style: '🎨', apply_style_to_chapter: '🎨',
  create_story: '📚', get_story_status: '📚',
  generate_title: '🏷️', generate_synopsis: '🏷️',
}

function getToolIcon(name: string): string {
  return toolIconMap[name] ?? '🔧'
}

function getToolArgSummary(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'write_chapter':
    case 'rewrite_chapter': {
      const idx = args.index as number
      const chapter = typeof idx === 'number' ? `第${idx + 1}章` : ''
      const preview = typeof args.content === 'string' ? args.content.slice(0, 30).replace(/\n/g, ' ') : ''
      return [chapter, preview].filter(Boolean).join(' · ')
    }
    case 'plan_chapters': {
      const chapters = args.chapters as Array<{ title: string }> | undefined
      return chapters?.length ? `${chapters.length} 章 · ${chapters.map(c => c.title).join(', ')}` : ''
    }
    case 'create_character':
    case 'update_character': {
      const charName = args.name as string | undefined
      const role = args.role as string | undefined
      return `${charName || '未命名'}${role ? ` (${role})` : ''}`
    }
    default: {
      const keys = Object.keys(args).slice(0, 3)
      return keys.length ? keys.join(', ') : ''
    }
  }
}

function parseToolResultDisplay(content: string): { success: boolean; summary: string; detail: string } {
  const parsed = JSON.parse(content)
  if (parsed.error) {
    return { success: false, summary: parsed.error, detail: content }
  }
  const parts: string[] = []
  if (parsed.count !== undefined) parts.push(`${parsed.count} 项`)
  if (parsed.wordCount !== undefined) parts.push(`${parsed.wordCount} 字`)
  if (parsed.title) parts.push(parsed.title)
  if (parsed.index !== undefined) parts.push(`第${parsed.index + 1}章`)
  if (typeof parsed.name === 'string') parts.push(parsed.name)
  return {
    success: true,
    summary: parts.join(' · ') || '操作成功',
    detail: JSON.stringify(parsed, null, 2),
  }
}

// Extract useful preview info from a streaming tool argument JSON (may be incomplete).
function extractStreamingToolPreview(name: string, raw: string): { label: string; preview?: string; wordCount: number } {
  if (name !== 'write_chapter' && name !== 'rewrite_chapter') {
    return { label: '', wordCount: 0 }
  }
  const idxMatch = raw.match(/"index"\s*:\s*(\d+)/)
  const index = idxMatch ? parseInt(idxMatch[1]) : undefined
  const contentMatch = raw.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)/)
  let preview = ''
  let wordCount = 0
  if (contentMatch) {
    preview = contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').slice(0, 80)
    wordCount = (contentMatch[1].match(/[\u4e00-\u9fa5]|[a-zA-Z]+/g) || []).length
  }
  return {
    label: index !== undefined ? `第${index + 1}章` : '',
    preview: preview || undefined,
    wordCount,
  }
}

// Expand/collapse state for tool call cards and tool result cards
const expandedToolCalls = ref<Record<string, boolean>>({})
const expandedToolResults = ref<Record<string, boolean>>({})

function toggleToolCall(key: string) {
  expandedToolCalls.value[key] = !expandedToolCalls.value[key]
}

function toggleToolResult(key: string) {
  expandedToolResults.value[key] = !expandedToolResults.value[key]
}

async function send() {
  const text = input.value.trim()
  if (!text || isGenerating.value) return
  input.value = ''

  pushMessage({
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  })
  scrollToBottom()

  isGenerating.value = true
  streamingContent.value = ''
  streamingToolContent.value = ''
  streamingToolName.value = ''
  toolStatus.value = ''
  abortController.value = new AbortController()

  try {
    const result = await runAgentLoop({
      novelId: props.novelId,
      userMessage: text,
      modelConfigId: selectedModelId.value,
      signal: abortController.value.signal,
      onToken(token) {
        streamingContent.value += token
        scrollToBottom()
      },
      onToolCall(name) {
        toolStatus.value = `正在调用: ${getToolDisplayName(name)}`
        streamingToolName.value = name
        streamingToolContent.value = ''
        scrollToBottom()
      },
      onToolResult(name, result) {
        pushMessage({
          id: crypto.randomUUID(),
          role: 'tool',
          content: result,
          toolName: name,
          timestamp: Date.now(),
        })
        toolStatus.value = ''
        streamingToolName.value = ''
        streamingToolContent.value = ''
        scrollToBottom()
      },
      onToolStreamToken(_toolName, token) {
        if (streamingToolContent.value.length < 5000) {
          streamingToolContent.value += token
        }
        scrollToBottom()
      },
      onError(err) {
        pushMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `错误: ${err}`,
          timestamp: Date.now(),
        })
      },
    })

    // Push final messages from result (callbacks already handled tool activity)
    for (const msg of result) {
      if (msg.role === 'user') continue
      if (msg.role === 'tool') continue // Already pushed via onToolResult
      if (msg.role === 'assistant') {
        // Skip tool-call-only messages (already shown via onToolCall/onToolResult callbacks)
        if (msg.toolCalls?.length && !msg.content) continue
        pushMessage(msg)
        continue
      }
      // System messages (errors, cancellation)
      pushMessage(msg)
    }
  } catch {
    pushMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: '发生未知错误，请重试',
      timestamp: Date.now(),
    })
  } finally {
    streamingContent.value = ''
    streamingToolContent.value = ''
    streamingToolName.value = ''
    toolStatus.value = ''
    isGenerating.value = false
    abortController.value = null
    scrollToBottom()
  }
}

function cancel() {
  abortController.value?.abort()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-3xl mx-auto px-4 py-3 space-y-3">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[85%] rounded-lg px-3 py-2 text-sm"
            :class="
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : msg.role === 'tool'
                  ? 'bg-muted/50 text-xs'
                  : 'bg-muted text-foreground'
            "
          >
            <!-- Assistant with only tool calls, no text -->
            <template v-if="msg.role === 'assistant' && msg.toolCalls?.length && !msg.content">
              <div class="space-y-1">
                <div v-for="tc in msg.toolCalls" :key="tc.id">
                  <button
                    class="w-full text-left flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 group"
                    @click="toggleToolCall(tc.id)"
                  >
                    <span class="shrink-0">{{ getToolIcon(tc.name) }}</span>
                    <span class="font-medium">{{ getToolDisplayName(tc.name) }}</span>
                    <span v-if="getToolArgSummary(tc.name, tc.arguments)" class="text-muted-foreground/60 truncate">
                      — {{ getToolArgSummary(tc.name, tc.arguments) }}
                    </span>
                    <ChevronDown
                      class="size-3 shrink-0 ml-auto transition-transform duration-150"
                      :class="!!expandedToolCalls[tc.id] ? 'rotate-180' : ''"
                    />
                  </button>
                  <div
                    v-if="!!expandedToolCalls[tc.id]"
                    class="mt-1 text-xs font-mono bg-muted/30 rounded p-2 overflow-x-auto"
                  >
                    <pre class="whitespace-pre-wrap break-all text-muted-foreground">{{ JSON.stringify(tc.arguments, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </template>
            <!-- Tool result -->
            <template v-else-if="msg.role === 'tool'">
              <button
                class="w-full text-left flex items-center gap-1.5 text-xs py-0.5 group"
                :class="parseToolResultDisplay(msg.content).success ? 'text-muted-foreground hover:text-foreground' : 'text-destructive'"
                @click="toggleToolResult(msg.id)"
              >
                <span class="shrink-0">{{ getToolIcon(msg.toolName!) }}</span>
                <span class="font-medium">{{ getToolDisplayName(msg.toolName!) }}</span>
                <span class="truncate">{{ parseToolResultDisplay(msg.content).summary }}</span>
                <ChevronDown
                  class="size-3 shrink-0 ml-auto transition-transform duration-150"
                  :class="!!expandedToolResults[msg.id] ? 'rotate-180' : ''"
                />
              </button>
              <div
                v-if="!!expandedToolResults[msg.id]"
                class="mt-1 text-xs font-mono bg-muted/30 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto"
              >
                <pre class="whitespace-pre-wrap break-all text-muted-foreground">{{ parseToolResultDisplay(msg.content).detail }}</pre>
              </div>
            </template>
            <!-- Assistant markdown content -->
            <template v-else-if="msg.role === 'assistant'">
              <MarkdownRender
                custom-id="agent-chat"
                :content="msg.content"
                :final="true"
                :is-dark="isDark"
                render-code-blocks-as-pre
              />
              <div v-if="msg.toolCalls?.length" class="border-t border-border/50 space-y-1" :class="msg.content ? 'mt-2 pt-2' : ''">
                <div v-for="tc in msg.toolCalls" :key="tc.id">
                  <button
                    class="w-full text-left flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 group"
                    @click="toggleToolCall(tc.id)"
                  >
                    <span class="shrink-0">{{ getToolIcon(tc.name) }}</span>
                    <span class="font-medium">{{ getToolDisplayName(tc.name) }}</span>
                    <span v-if="getToolArgSummary(tc.name, tc.arguments)" class="text-muted-foreground/60 truncate">
                      — {{ getToolArgSummary(tc.name, tc.arguments) }}
                    </span>
                    <ChevronDown
                      class="size-3 shrink-0 ml-auto transition-transform duration-150"
                      :class="!!expandedToolCalls[tc.id] ? 'rotate-180' : ''"
                    />
                  </button>
                  <div
                    v-if="!!expandedToolCalls[tc.id]"
                    class="mt-1 text-xs font-mono bg-muted/30 rounded p-2 overflow-x-auto"
                  >
                    <pre class="whitespace-pre-wrap break-all text-muted-foreground">{{ JSON.stringify(tc.arguments, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </template>
            <!-- Other role text (system messages) -->
            <template v-else>
              {{ msg.content }}
            </template>
          </div>
        </div>

        <!-- Tool status indicator during execution -->
        <div v-if="toolStatus" class="flex justify-start">
          <div class="max-w-[85%] rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 class="size-3 animate-spin" />
            {{ toolStatus }}
          </div>
        </div>

        <!-- Streaming tool content -->
        <div v-if="streamingToolContent && !streamingContent" class="flex justify-start">
          <div class="max-w-[85%] rounded-lg bg-muted/50 px-3 py-2 text-xs">
            <template v-if="streamingToolName === 'write_chapter' || streamingToolName === 'rewrite_chapter'">
              <div class="flex items-center gap-1.5 text-muted-foreground mb-1">
                <span>{{ getToolIcon(streamingToolName) }}</span>
                <span class="font-medium">{{ getToolDisplayName(streamingToolName) }}</span>
                <template v-if="extractStreamingToolPreview(streamingToolName, streamingToolContent).label">
                  · {{ extractStreamingToolPreview(streamingToolName, streamingToolContent).label }}
                </template>
                <template v-if="extractStreamingToolPreview(streamingToolName, streamingToolContent).wordCount > 0">
                  · <span class="tabular-nums">{{ extractStreamingToolPreview(streamingToolName, streamingToolContent).wordCount }} 字</span>
                </template>
              </div>
              <div
                v-if="extractStreamingToolPreview(streamingToolName, streamingToolContent).preview"
                class="text-muted-foreground/70 whitespace-pre-wrap leading-relaxed"
              >
                {{ extractStreamingToolPreview(streamingToolName, streamingToolContent).preview }}...
              </div>
              <div v-else class="text-muted-foreground/50 italic">
                正在接收内容...
              </div>
            </template>
            <template v-else>
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 class="size-3 animate-spin" />
                <span>{{ getToolDisplayName(streamingToolName) || '工具' }} — 处理中...</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Streaming text content -->
        <div v-if="streamingContent" class="flex justify-start">
          <div class="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm">
            <MarkdownRender
              custom-id="agent-chat"
              :nodes="streamingNodes"
              :final="false"
              :is-dark="isDark"
              :typewriter="false"
              render-code-blocks-as-pre
            />
            <span
              class="inline-block w-1.5 h-4 bg-foreground animate-pulse ml-0.5 align-text-bottom"
            />
          </div>
        </div>

        <div id="chat-bottom" />
      </div>
    </div>

    <div class="shrink-0 bg-background">
      <div class="max-w-3xl mx-auto px-4 pt-3 pb-4">
        <div
          class="rounded-xl border border-input bg-transparent transition-colors focus-within:border-ring dark:bg-input/30"
        >
          <textarea
            v-model="input"
            placeholder="输入你的想法或反馈..."
            rows="1"
            class="block w-full resize-none bg-transparent px-3 pt-3 pb-0.5 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm field-sizing-content min-h-0"
            :disabled="isGenerating"
            @keydown.enter.exact.prevent="send"
          />

          <div class="flex items-center gap-1.5 px-3 pb-2.5">
            <DropdownMenu v-if="models.length > 0">
              <DropdownMenuTrigger
                as="button"
                class="flex items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <span class="truncate">{{ selectedModelLabel }}</span>
                <ChevronDown class="size-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  v-for="m in models"
                  :key="m.id"
                  @click="selectedModelId = m.id"
                >
                  <span class="text-xs">{{ modelLabel(m) }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div class="ml-auto flex items-center gap-1">
              <Button
                v-if="!isGenerating"
                size="icon"
                class="size-7"
                :disabled="!input.trim()"
                @click="send"
              >
                <Send class="size-3.5" />
              </Button>
              <Button
                v-else
                variant="destructive"
                size="icon"
                class="size-7"
                @click="cancel"
              >
                <Square class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
