<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { Send, Square, ChevronDown, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { runAgentLoop } from '@/agent/loop'
import { getConfig } from '@/db/config'
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

async function loadModels() {
  const config = await getConfig()
  models.value = config.models
  selectedModelId.value = config.defaultModelId || config.models[0]?.id || ''
}

onMounted(loadModels)

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

function formatToolResult(content: string): string {
  try {
    const parsed = JSON.parse(content)
    if (parsed.error) return `错误: ${parsed.error}`
    if (parsed.success !== undefined) {
      const parts: string[] = []
      if (parsed.count !== undefined) parts.push(`${parsed.count} 项`)
      if (parsed.wordCount !== undefined) parts.push(`${parsed.wordCount} 字`)
      if (parsed.title) parts.push(parsed.title)
      if (parsed.id) parts.push(`ID: ${typeof parsed.id === 'string' ? parsed.id.slice(0, 8) : parsed.id}`)
      return parts.length > 0 ? parts.join(' | ') : '操作成功'
    }
    return content.slice(0, 200)
  } catch {
    return content.slice(0, 200)
  }
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
        // Push a formatted tool result indicator
        pushMessage({
          id: crypto.randomUUID(),
          role: 'tool',
          content: `${getToolDisplayName(name)}: ${formatToolResult(result)}`,
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
                  ? 'bg-muted/50 text-muted-foreground text-xs font-mono'
                  : 'bg-muted text-foreground'
            "
          >
            <!-- Assistant with only tool calls, no text -->
            <template v-if="msg.role === 'assistant' && msg.toolCalls?.length && !msg.content">
              <div class="text-xs text-muted-foreground space-y-0.5">
                <div v-for="tc in msg.toolCalls" :key="tc.id">
                  -> {{ getToolDisplayName(tc.name) }}
                </div>
              </div>
            </template>
            <!-- Tool result -->
            <template v-else-if="msg.role === 'tool'">
              {{ msg.content }}
            </template>
            <!-- Normal text content -->
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

        <!-- Streaming tool content (raw arg tokens) -->
        <div v-if="streamingToolContent && !streamingContent" class="flex justify-start">
          <div class="max-w-[85%] rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
            {{ streamingToolContent }}
          </div>
        </div>

        <!-- Streaming text content -->
        <div v-if="streamingContent" class="flex justify-start">
          <div class="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm">
            {{ streamingContent }}
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
