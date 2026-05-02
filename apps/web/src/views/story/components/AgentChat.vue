<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDark } from '@vueuse/core'
import { BookOpen, Bot, BrainCircuit, ChevronDown, Copy, Loader2, Send, Square } from 'lucide-vue-next'
import MarkdownRender from 'markstream-vue'
import { toast } from 'vue-sonner'
import { runAgentLoop } from '@/agent/loop'
import { cloneMessages } from '@/agent/message-state'
import { compactConversationContext } from '@/agent/context-compaction'
import { loadStoryState } from '@/agent/story-state'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getConfig } from '@/db/config'
import { getConversationByNovelId } from '@/db/conversations'
import type {
  AssistantMessage,
  AssistantPart,
  Message,
  ModelConfig,
  StatusMessage,
} from '@/db/types'
import { modelLabel } from '@/lib/model-utils'
import { relativeTime } from '@/lib/time'
import ThinkingCard from './ThinkingCard.vue'
import ToolCard from './ToolCard.vue'

const props = defineProps<{
  novelId: string
}>()

type DisplayItem =
  | {
      type: 'user'
      id: string
      content: string
      timestamp: number
    }
  | {
      type: 'status'
      id: string
      content: string
      timestamp: number
      kind: StatusMessage['kind']
    }
  | {
      type: 'reasoning'
      id: string
      content: string
      timestamp: number
    }
  | {
      type: 'assistant'
      id: string
      content: string
      timestamp: number
      isStreaming: boolean
    }
  | {
      type: 'tool_card'
      id: string
      toolName: string
      rawArguments: string
      parsedArguments: Record<string, unknown> | null
      result: string | null
      timestamp: number
      status: 'pending' | 'completed' | 'cancelled' | 'error'
    }

interface TurnGroup {
  turnId: string
  timestamp: number
  items: DisplayItem[]
}

const input = ref('')
const persistedMessages = ref<Message[]>([])
const unsavedMessages = ref<Message[]>([])
const localStatusMessages = ref<StatusMessage[]>([])
const transientMessages = ref<Message[]>([])
const isGenerating = ref(false)
const isCompacting = ref(false)
const abortController = ref<AbortController | null>(null)
const isDark = useDark()
let activeRequestId = 0
let activeConversationLoadId = 0

const models = ref<ModelConfig[]>([])
const selectedModelId = ref('')

const selectedModelLabel = computed(() => {
  const model = models.value.find((item) => item.id === selectedModelId.value)
  return model ? modelLabel(model) : '选择模型'
})

const selectedModelProvider = computed(() => {
  const model = models.value.find((item) => item.id === selectedModelId.value)
  return model?.provider?.[0]?.toUpperCase() || '?'
})

const historyMessages = computed(() => [...persistedMessages.value, ...unsavedMessages.value])
const timelineMessages = computed(() => [
  ...historyMessages.value,
  ...localStatusMessages.value,
  ...transientMessages.value,
])

function isSameAssistantMessage(left: AssistantMessage, right: AssistantMessage): boolean {
  return left.id === right.id
}

function getStreamingAssistantMessage(messages: Message[]): AssistantMessage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message?.role === 'assistant') return message
  }
  return null
}

function getLastTextPartIndex(message: AssistantMessage): number {
  for (let index = message.parts.length - 1; index >= 0; index--) {
    if (message.parts[index]?.type === 'text') return index
  }
  return -1
}

function buildDisplayItemFromAssistantPart(
  message: AssistantMessage,
  part: AssistantPart,
  index: number,
  streamingAssistant: AssistantMessage | null,
): DisplayItem {
  const id = `${message.id}:${index}`

  if (part.type === 'reasoning') {
    return {
      type: 'reasoning',
      id,
      content: part.text,
      timestamp: message.timestamp,
    }
  }

  if (part.type === 'text') {
    return {
      type: 'assistant',
      id,
      content: part.text,
      timestamp: message.timestamp,
      isStreaming:
        !!streamingAssistant
        && isSameAssistantMessage(message, streamingAssistant)
        && index === getLastTextPartIndex(streamingAssistant),
    }
  }

  return {
    type: 'tool_card',
    id,
    toolName: part.toolName,
    rawArguments: part.rawArguments,
    parsedArguments: part.arguments,
    result: part.result,
    timestamp: message.timestamp,
    status: part.status,
  }
}

function buildDisplayItems(messages: Message[]): DisplayItem[] {
  const items: DisplayItem[] = []
  const streamingAssistant = getStreamingAssistantMessage(transientMessages.value)

  for (const message of messages) {
    switch (message.role) {
      case 'user':
        items.push({
          type: 'user',
          id: message.id,
          content: message.content,
          timestamp: message.timestamp,
        })
        break
      case 'status':
        items.push({
          type: 'status',
          id: message.id,
          content: message.content,
          timestamp: message.timestamp,
          kind: message.kind,
        })
        break
      case 'assistant':
        for (const [index, part] of message.parts.entries()) {
          items.push(buildDisplayItemFromAssistantPart(message, part, index, streamingAssistant))
        }
        break
    }
  }

  return items
}

const displayItems = computed(() => buildDisplayItems(timelineMessages.value))

/** Group display items into conversation turns (each turn starts with a user message) */
const turnGroups = computed<TurnGroup[]>(() => {
  const groups: TurnGroup[] = []
  let currentGroup: TurnGroup | null = null

  for (const item of displayItems.value) {
    if (item.type === 'user') {
      if (currentGroup) groups.push(currentGroup)
      currentGroup = {
        turnId: item.id,
        timestamp: item.timestamp,
        items: [item],
      }
    } else if (currentGroup) {
      currentGroup.items.push(item)
    } else {
      // Orphaned non-user items (e.g., status before first user msg)
      currentGroup = {
        turnId: item.id,
        timestamp: item.timestamp,
        items: [item],
      }
    }
  }

  if (currentGroup) groups.push(currentGroup)
  return groups
})

// ---- Scroll-to-bottom ----
const messagesContainer = ref<HTMLElement | null>(null)
const isNearBottom = ref(true)

function checkScrollPosition() {
  const el = messagesContainer.value
  if (!el) return
  isNearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

async function loadModels() {
  const config = await getConfig()
  models.value = config.models
  selectedModelId.value = config.defaultModelId || config.models[0]?.id || ''
}

async function loadConversation() {
  const loadId = ++activeConversationLoadId
  const novelId = props.novelId
  const conversation = await getConversationByNovelId(novelId)
  if (loadId !== activeConversationLoadId || novelId !== props.novelId) return
  persistedMessages.value = conversation?.messages ?? []
  unsavedMessages.value = []
  localStatusMessages.value = []
}

function resetTransientState() {
  transientMessages.value = []
  isGenerating.value = false
  abortController.value = null
}

function pushLocalStatus(kind: StatusMessage['kind'], content: string) {
  localStatusMessages.value.push({
    id: crypto.randomUUID(),
    role: 'status',
    kind,
    content,
    timestamp: Date.now(),
  })
}

let scrollRAF = 0
function scrollToBottom() {
  cancelAnimationFrame(scrollRAF)
  scrollRAF = requestAnimationFrame(() => {
    nextTick(() => {
      document.getElementById('chat-bottom')?.scrollIntoView({ behavior: 'smooth' })
    })
  })
}

function forceScrollToBottom() {
  const el = document.getElementById('chat-bottom')
  if (el) {
    el.scrollIntoView({ behavior: 'instant' })
  }
  isNearBottom.value = true
}

async function reloadForNovel() {
  activeRequestId++
  abortController.value?.abort()
  resetTransientState()
  await loadConversation()
  forceScrollToBottom()
}

onMounted(async () => {
  await loadModels()
  await loadConversation()
  forceScrollToBottom()
})

onUnmounted(() => {
  const el = messagesContainer.value
  if (el) el.removeEventListener('scroll', checkScrollPosition)
})

watch(messagesContainer, (el) => {
  if (el) el.addEventListener('scroll', checkScrollPosition, { passive: true })
})

watch(() => props.novelId, async () => {
  await reloadForNovel()
})

async function send() {
  const text = input.value.trim()
  if (!text || isGenerating.value) return

  input.value = ''
  transientMessages.value = []
  isGenerating.value = true
  abortController.value = new AbortController()
  const requestId = ++activeRequestId
  const baseUnsavedMessages = cloneMessages(unsavedMessages.value)
  const baseHistoryMessages = cloneMessages(historyMessages.value)
  forceScrollToBottom()

  try {
    const result = await runAgentLoop({
      novelId: props.novelId,
      userMessage: text,
      modelConfigId: selectedModelId.value,
      historyMessages: baseHistoryMessages,
      signal: abortController.value.signal,
      onMessagesUpdated(messages) {
        if (requestId !== activeRequestId) return
        transientMessages.value = messages
        if (isNearBottom.value) scrollToBottom()
      },
      onError(error) {
        if (requestId !== activeRequestId) return
        toast.error('生成失败', { description: error })
      },
    })

    if (requestId !== activeRequestId) return

    transientMessages.value = result.messages

    if (result.persisted) {
      persistedMessages.value = [...baseHistoryMessages, ...result.messages]
      unsavedMessages.value = []
      localStatusMessages.value = []
      transientMessages.value = []
    } else {
      unsavedMessages.value = [...baseUnsavedMessages, ...result.messages]
      transientMessages.value = []
      if (result.persistenceError) {
        pushLocalStatus('error', `保存失败：${result.persistenceError}`)
        toast.error('对话未保存', {
          description: result.persistenceError,
        })
      }
    }
  } catch (error) {
    if (requestId !== activeRequestId) return
    pushLocalStatus('error', error instanceof Error ? error.message : String(error))
    toast.error('生成失败', {
      description: error instanceof Error ? error.message : String(error),
    })
  } finally {
    if (requestId === activeRequestId) {
      isGenerating.value = false
      abortController.value = null
      if (isNearBottom.value) scrollToBottom()
    }
  }
}

function cancel() {
  abortController.value?.abort()
}

async function compactContext() {
  if (isGenerating.value || isCompacting.value) return
  const model = models.value.find((item) => item.id === selectedModelId.value) ?? models.value[0]
  if (!model) {
    toast.error('请先配置模型')
    return
  }

  isCompacting.value = true
  try {
    const conversation = await getConversationByNovelId(props.novelId)
    const instructions = window.prompt('可选整理指令（留空表示自动整理）', '') ?? ''
    const result = await compactConversationContext({
      novelId: props.novelId,
      modelConfig: model,
      conversation: conversation ?? { novelId: props.novelId, messages: [], updatedAt: Date.now() },
      storyState: await loadStoryState(props.novelId),
      reason: 'manual',
      manualInstructions: instructions.trim() || undefined,
      force: true,
    })

    if (result.snapshot) {
      toast.success('上下文已整理', {
        description: `压缩前约 ${result.estimatedInputTokensBefore} token，压缩后约 ${result.estimatedInputTokensAfter} token`,
      })
    } else {
      toast.success('没有需要整理的上下文')
    }
  } catch (error) {
    toast.error('整理失败', {
      description: error instanceof Error ? error.message : String(error),
    })
  } finally {
    isCompacting.value = false
  }
}

// ---- Copy to clipboard ----
const copiedId = ref<string | null>(null)
async function copyAssistantText(item: DisplayItem) {
  if (item.type !== 'assistant') return
  try {
    await navigator.clipboard.writeText(item.content)
    copiedId.value = item.id
    setTimeout(() => { if (copiedId.value === item.id) copiedId.value = null }, 2000)
  } catch {
    toast.error('复制失败')
  }
}

// ---- Welcome suggestions ----
const welcomeSuggestions = [
  { icon: '✨', label: '告诉我你想要什么样的故事...', prompt: '告诉我你想要什么样的故事，我来帮你创作。' },
  { icon: '🎭', label: '帮我设计角色和世界观', prompt: '帮我设计一个故事的角色和世界观。' },
  { icon: '📖', label: '写一个章节让我看看', prompt: '写一个章节让我看看你的写作能力。' },
]
function fillSuggestion(prompt: string) {
  input.value = prompt
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-background">
    <!-- ===== Messages area ===== -->
    <div
      ref="messagesContainer"
      class="chat-messages flex-1 overflow-y-auto scroll-smooth"
    >
      <!-- WELCOME STATE -->
      <div
        v-if="displayItems.length === 0"
        class="flex min-h-full flex-col items-center justify-center px-6 py-12"
      >
        <div class="animate-welcome w-full max-w-lg text-center">
          <!-- Logo -->
          <div class="mb-6 inline-flex">
            <div class="relative">
              <div
                class="flex size-16 items-center justify-center rounded-lg bg-primary/8 ring-1 ring-primary/10 dark:bg-primary/15 dark:ring-primary/20"
              >
                <BookOpen class="size-7 text-primary/70" />
              </div>
              <div
                class="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm"
              >
                AI
              </div>
            </div>
          </div>

          <!-- Headline -->
          <h2 class="mb-2 text-xl font-semibold tracking-tight text-foreground">
            开始创作你的故事
          </h2>
          <p class="mb-8 text-sm text-muted-foreground">
            告诉我你的想法，我会帮你将灵感变为文字
          </p>

          <!-- Suggestion chips -->
          <div class="flex flex-col gap-2.5">
            <button
              v-for="suggestion in welcomeSuggestions"
              :key="suggestion.label"
              class="group flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 text-left text-sm text-muted-foreground shadow-xs transition-all hover:border-primary/30 hover:bg-primary/3 hover:text-foreground hover:shadow-sm"
              @click="fillSuggestion(suggestion.prompt)"
            >
              <span class="text-base">{{ suggestion.icon }}</span>
              <span class="leading-snug">{{ suggestion.label }}</span>
              <span class="ml-auto shrink-0 text-xs text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
                ↵
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- MESSAGES -->
      <div v-else class="mx-auto max-w-3xl px-4 py-4">
        <TransitionGroup name="message-enter" tag="div">
          <div
            v-for="(group, gi) in turnGroups"
            :key="group.turnId"
            :style="{ '--stagger': gi }"
          >
            <!-- Turn divider with timestamp -->
            <div class="my-3 flex items-center gap-3 first:mt-0">
              <div class="h-px flex-1 bg-border/60" />
              <span class="shrink-0 text-[11px] text-muted-foreground/50">
                {{ relativeTime(group.timestamp) }}
              </span>
              <div class="h-px flex-1 bg-border/60" />
            </div>

            <!-- Messages in this turn -->
            <div class="space-y-2">
              <template v-for="item in group.items" :key="item.id">
                <!-- USER MESSAGE -->
                <div v-if="item.type === 'user'" class="flex justify-end">
                  <div class="max-w-[75%]">
                    <div
                      class="rounded-lg rounded-br-sm bg-primary px-4 py-1.5 text-sm leading-relaxed text-primary-foreground shadow-sm"
                    >
                      {{ item.content }}
                    </div>
                  </div>
                </div>

                <!-- STATUS MESSAGE (inline centered badge) -->
                <div v-else-if="item.type === 'status'" class="flex justify-center py-0.5">
                  <div
                    v-if="item.kind === 'error'"
                    class="inline-flex items-center gap-1.5 rounded-full bg-destructive/8 px-3 py-1 text-xs text-destructive"
                  >
                    <span class="size-1.5 shrink-0 rounded-full bg-destructive" />
                    {{ item.content }}
                  </div>
                  <div
                    v-else-if="item.kind === 'warning'"
                    class="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-3 py-1 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                  >
                    <span class="size-1.5 shrink-0 rounded-full bg-amber-500" />
                    {{ item.content }}
                  </div>
                  <div
                    v-else-if="item.kind === 'cancelled'"
                    class="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60"
                  >
                    <span class="mr-0.5">┄</span>
                    <span class="line-through decoration-muted-foreground/30">{{ item.content }}</span>
                    <span class="ml-0.5">┄</span>
                  </div>
                  <span
                    v-else
                    class="text-xs text-muted-foreground/50"
                  >
                    {{ item.content }}
                  </span>
                </div>

                <!-- ASSISTANT AVATAR + BUBBLE (wraps assistant, reasoning, tool_card) -->
                <div
                  v-else-if="item.type === 'assistant' || item.type === 'reasoning' || item.type === 'tool_card'"
                  class="flex items-start gap-2.5"
                >
                  <!-- AI Avatar -->
                  <div
                    class="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20"
                  >
                    <Bot class="size-3.5" />
                  </div>

                  <!-- Content area -->
                  <div class="min-w-0">
                    <!-- Assistant text bubble -->
                    <div
                      v-if="item.type === 'assistant'"
                      class="group relative max-w-[85%] rounded-lg rounded-bl-sm border bg-card px-4 py-2 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <!-- Copy button -->
                      <button
                        v-if="item.content"
                        class="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        :class="{ 'opacity-100 text-foreground': copiedId === item.id }"
                        @click="copyAssistantText(item)"
                      >
                        <Copy class="size-3.5" />
                      </button>

                      <MarkdownRender
                        custom-id="agent-chat"
                        :content="item.content"
                        :final="!item.isStreaming"
                        :is-dark="isDark"
                        :typewriter="false"
                        render-code-blocks-as-pre
                      />

                      <!-- Streaming cursor: pulsing vertical bar -->
                      <span
                        v-if="item.isStreaming"
                        class="ml-0.5 inline-block h-[1.15em] w-0.5 animate-pulse rounded-full bg-primary align-text-bottom"
                      />
                    </div>

                    <!-- Thinking inline -->
                    <div v-else-if="item.type === 'reasoning'" class="max-w-[85%]">
                      <ThinkingCard :content="item.content" />
                    </div>

                    <!-- Tool card (renders its own wrapper) -->
                    <ToolCard
                      v-else-if="item.type === 'tool_card'"
                      :tool-name="item.toolName"
                      :raw-arguments="item.rawArguments"
                      :parsed-arguments="item.parsedArguments"
                      :result="item.result"
                      :status="item.status"
                    />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </TransitionGroup>

        <div id="chat-bottom" class="h-px" />
      </div>
    </div>

    <!-- ===== Scroll-to-bottom button ===== -->
    <div
      v-if="!isNearBottom && displayItems.length > 0"
      class="pointer-events-none absolute bottom-28 right-6 z-10"
    >
      <button
        class="pointer-events-auto flex size-8 items-center justify-center rounded-full border bg-card shadow-md transition-all hover:bg-muted hover:shadow-lg"
        @click="forceScrollToBottom"
      >
        <ChevronDown class="size-4 text-muted-foreground" />
      </button>
    </div>

    <!-- ===== Input area ===== -->
    <div class="shrink-0 bg-background">
      <div class="mx-auto max-w-3xl px-4 pb-4 pt-2">
        <div
          class="rounded-lg border bg-card shadow-lg transition-all focus-within:border-ring/50 focus-within:shadow-xl dark:bg-card"
        >
          <textarea
            v-model="input"
            placeholder="输入你的想法或反馈... (Ctrl+Enter 发送)"
            rows="1"
            class="field-sizing-content block min-h-0 w-full resize-none bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            :disabled="isGenerating"
            @keydown.enter.exact.prevent="send"
          />

          <div class="flex items-center gap-2 px-3 pb-3">
            <!-- Model selector -->
            <DropdownMenu v-if="models.length > 0">
              <DropdownMenuTrigger
                as="button"
                class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span class="flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70">
                  {{ selectedModelProvider }}
                </span>
                <span class="max-w-[120px] truncate">{{ selectedModelLabel }}</span>
                <ChevronDown class="size-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" class="min-w-[200px]">
                <DropdownMenuItem
                  v-for="model in models"
                  :key="model.id"
                  class="flex items-center gap-2"
                  @click="selectedModelId = model.id"
                >
                  <span class="flex size-5 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70">
                    {{ model.provider[0]?.toUpperCase() }}
                  </span>
                  <span class="text-xs">{{ modelLabel(model) }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <!-- "配置模型" link when no models -->
            <router-link
              v-else
              :to="{ name: 'model-config' }"
              class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <BrainCircuit class="size-3.5" />
              <span>配置模型</span>
            </router-link>

            <!-- Compact context -->
            <Button
              variant="ghost"
              size="xs"
              class="text-xs text-muted-foreground hover:text-foreground"
              :disabled="isGenerating || isCompacting || models.length === 0"
              @click="compactContext"
            >
              <Loader2 v-if="isCompacting" class="mr-1 size-3 animate-spin" />
              <span>整理上下文</span>
            </Button>

            <div class="ml-auto flex items-center gap-1">
              <Button
                v-if="!isGenerating"
                size="icon-sm"
                variant="default"
                class="bg-primary/90 hover:bg-primary"
                :disabled="!input.trim()"
                @click="send"
              >
                <Send class="size-3.5" />
              </Button>
              <Button
                v-else
                variant="destructive"
                size="icon-sm"
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

<style scoped>
/* ---- Scrollbar ---- */
.chat-messages::-webkit-scrollbar {
  width: 5px;
}
.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}
.chat-messages::-webkit-scrollbar-thumb {
  background: oklch(0.922 0 0);
  border-radius: 3px;
}
.chat-messages::-webkit-scrollbar-thumb:hover {
  background: oklch(0.87 0 0);
}
.dark .chat-messages::-webkit-scrollbar-thumb {
  background: oklch(0.269 0 0);
}
.dark .chat-messages::-webkit-scrollbar-thumb:hover {
  background: oklch(0.371 0 0);
}

/* ---- Welcome animation ---- */
@keyframes welcome-fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-welcome {
  animation: welcome-fade-up 400ms ease-out both;
}

/* ---- Message entrance animation ---- */
.message-enter-enter-active {
  transition:
    opacity 200ms ease-out,
    transform 200ms ease-out;
  animation-delay: calc(var(--stagger, 0) * 30ms);
}

.message-enter-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.message-enter-enter-to {
  opacity: 1;
  transform: translateY(0);
}

/* Smooth scrolling */
.scroll-smooth {
  scroll-behavior: smooth;
}
</style>
