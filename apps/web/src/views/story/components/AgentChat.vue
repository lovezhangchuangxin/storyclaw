<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useDark } from '@vueuse/core'
import { Send, Square, ChevronDown } from 'lucide-vue-next'
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
import ToolCard from './ToolCard.vue'
import ThinkingCard from './ThinkingCard.vue'

const props = defineProps<{
  novelId: string
}>()

type DisplayItem =
  | { type: 'user'; id: string; content: string; timestamp: number }
  | { type: 'assistant'; id: string; content: string; timestamp: number }
  | { type: 'reasoning'; id: string; content: string; timestamp: number }
  | { type: 'tool_card'; id: string; toolName: string; arguments?: Record<string, unknown>; result?: string | null; timestamp: number }
  | { type: 'system'; id: string; content: string; timestamp: number }

const input = ref('')
const messages = ref<Message[]>([])
const isGenerating = ref(false)
const streamingContent = ref('')
const abortController = ref<AbortController | null>(null)

const streamingToolContent = ref('')
const streamingToolName = ref('')
const streamingToolCallId = ref('')
const streamingReasoning = ref('')

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

function messagesToDisplayItems(msgs: Message[]): DisplayItem[] {
  const items: DisplayItem[] = []
  let i = 0
  while (i < msgs.length) {
    const msg = msgs[i]
    switch (msg.role) {
      case 'user':
        items.push({ type: 'user', id: msg.id, content: msg.content, timestamp: msg.timestamp })
        break
      case 'assistant':
        if (msg.content) {
          items.push({ type: 'assistant', id: msg.id, content: msg.content, timestamp: msg.timestamp })
        }
        break
      case 'reasoning':
        items.push({ type: 'reasoning', id: msg.id, content: msg.content, timestamp: msg.timestamp })
        break
      case 'tool_call': {
        const next = msgs[i + 1]
        if (next?.role === 'tool' && next.toolCallId === msg.toolCallId) {
          items.push({
            type: 'tool_card',
            id: msg.id,
            toolName: msg.toolName!,
            arguments: msg.arguments,
            result: next.content,
            timestamp: msg.timestamp,
          })
          i++
        } else {
          items.push({
            type: 'tool_card',
            id: msg.id,
            toolName: msg.toolName!,
            arguments: msg.arguments,
            result: null,
            timestamp: msg.timestamp,
          })
        }
        break
      }
      case 'tool':
        break
      case 'system':
        items.push({ type: 'system', id: msg.id, content: msg.content, timestamp: msg.timestamp })
        break
    }
    i++
  }
  return items
}

const displayItems = computed<DisplayItem[]>(() => {
  const base = messagesToDisplayItems(messages.value)
  if (streamingReasoning.value && !streamingContent.value) {
    base.push({
      type: 'reasoning',
      id: 'stream-reasoning',
      content: streamingReasoning.value,
      timestamp: Date.now(),
    })
  }
  return base
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
  streamingToolCallId.value = ''
  streamingReasoning.value = ''
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
      onReasoningToken(token) {
        streamingReasoning.value += token
        scrollToBottom()
      },
      onToolCall(toolCallId, name) {
        pushMessage({
          id: crypto.randomUUID(),
          role: 'tool_call',
          content: '',
          toolCallId,
          toolName: name,
          timestamp: Date.now(),
        })
        streamingToolCallId.value = toolCallId
        streamingToolName.value = name
        streamingToolContent.value = ''
        scrollToBottom()
      },
      onToolResult(toolCallId, name, result) {
        const msg = messages.value.find(
          (m) => m.role === 'tool_call' && m.toolCallId === toolCallId,
        )
        if (msg) {
          pushMessage({
            id: crypto.randomUUID(),
            role: 'tool',
            content: result,
            toolCallId,
            toolName: name,
            timestamp: Date.now(),
          })
        }
        streamingToolName.value = ''
        streamingToolCallId.value = ''
        streamingToolContent.value = ''
        scrollToBottom()
      },
      onToolStreamToken(_toolCallId, _toolName, token) {
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

    for (const msg of result) {
      if (msg.role === 'user') continue
      if (msg.role === 'tool_call' || msg.role === 'tool' || msg.role === 'reasoning') continue
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
    streamingToolCallId.value = ''
    streamingReasoning.value = ''
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
      <div class="max-w-3xl mx-auto px-4 py-3 space-y-2">
        <template v-for="item in displayItems" :key="item.id">
          <!-- User message -->
          <div v-if="item.type === 'user'" class="flex justify-end">
            <div class="max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm">
              {{ item.content }}
            </div>
          </div>

          <!-- System message -->
          <div v-else-if="item.type === 'system'" class="flex justify-start">
            <div class="max-w-[85%] rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {{ item.content }}
            </div>
          </div>

          <!-- Reasoning / thinking -->
          <div v-else-if="item.type === 'reasoning'" class="flex justify-start">
            <div class="max-w-[85%]">
              <ThinkingCard :content="item.content" />
            </div>
          </div>

          <!-- Tool card -->
          <ToolCard
            v-else-if="item.type === 'tool_card'"
            :tool-name="item.toolName"
            :arguments="item.arguments"
            :result="item.result"
          />

          <!-- Assistant text -->
          <div v-else-if="item.type === 'assistant'" class="flex justify-start">
            <div class="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              <MarkdownRender
                custom-id="agent-chat"
                :content="item.content"
                :final="true"
                :is-dark="isDark"
                render-code-blocks-as-pre
              />
            </div>
          </div>
        </template>

        <!-- Streaming tool content (write_chapter streaming) -->
        <div v-if="streamingToolContent && !streamingContent" class="flex justify-start">
          <div class="max-w-[85%] rounded-lg bg-muted/50 px-3 py-2 text-xs">
            <div class="flex items-center gap-1.5 text-muted-foreground mb-1">
              <span>✍️</span>
              <span class="font-medium">
                {{ streamingToolName === 'rewrite_chapter' ? '重写章节' : '创作章节' }}
              </span>
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
