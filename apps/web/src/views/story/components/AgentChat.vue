<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useDark } from '@vueuse/core'
import { ChevronDown, Loader2, Send, Square } from 'lucide-vue-next'
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

async function reloadForNovel() {
  activeRequestId++
  abortController.value?.abort()
  resetTransientState()
  await loadConversation()
  scrollToBottom()
}

onMounted(async () => {
  await loadModels()
  await loadConversation()
  scrollToBottom()
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
  scrollToBottom()

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
        scrollToBottom()
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
      scrollToBottom()
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

function statusClass(kind: StatusMessage['kind']) {
  switch (kind) {
    case 'error':
      return 'bg-red-50/40 text-red-700 dark:bg-red-950/20 dark:text-red-300'
    case 'warning':
      return 'bg-amber-50/40 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300'
    case 'cancelled':
      return 'bg-amber-50/40 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300'
    default:
      return 'bg-muted/50 text-muted-foreground'
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl space-y-2 px-4 py-3">
        <template v-for="item in displayItems" :key="item.id">
          <div v-if="item.type === 'user'" class="flex justify-end">
            <div class="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              {{ item.content }}
            </div>
          </div>

          <div v-else-if="item.type === 'status'" class="flex justify-start">
            <div
              class="max-w-[85%] rounded-lg px-3 py-2 text-xs"
              :class="statusClass(item.kind)"
            >
              {{ item.content }}
            </div>
          </div>

          <div v-else-if="item.type === 'reasoning'" class="flex justify-start">
            <div class="max-w-[85%]">
              <ThinkingCard :content="item.content" />
            </div>
          </div>

          <ToolCard
            v-else-if="item.type === 'tool_card'"
            :tool-name="item.toolName"
            :raw-arguments="item.rawArguments"
            :parsed-arguments="item.parsedArguments"
            :result="item.result"
            :status="item.status"
          />

          <div v-else-if="item.type === 'assistant'" class="flex justify-start">
            <div class="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              <MarkdownRender
                custom-id="agent-chat"
                :content="item.content"
                :final="!item.isStreaming"
                :is-dark="isDark"
                :typewriter="false"
                render-code-blocks-as-pre
              />
              <span
                v-if="item.isStreaming"
                class="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground align-text-bottom"
              />
            </div>
          </div>
        </template>

        <div id="chat-bottom" />
      </div>
    </div>

    <div class="shrink-0 bg-background">
      <div class="mx-auto max-w-3xl px-4 pb-4 pt-3">
        <div
          class="rounded-xl border border-input bg-transparent transition-colors focus-within:border-ring dark:bg-input/30"
        >
          <textarea
            v-model="input"
            placeholder="输入你的想法或反馈..."
            rows="1"
            class="field-sizing-content block min-h-0 w-full resize-none bg-transparent px-3 pb-0.5 pt-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            :disabled="isGenerating"
            @keydown.enter.exact.prevent="send"
          />

          <div class="flex items-center gap-1.5 px-3 pb-2.5">
            <DropdownMenu v-if="models.length > 0">
              <DropdownMenuTrigger
                as="button"
                class="flex items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <span class="truncate">{{ selectedModelLabel }}</span>
                <ChevronDown class="size-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  v-for="model in models"
                  :key="model.id"
                  @click="selectedModelId = model.id"
                >
                  <span class="text-xs">{{ modelLabel(model) }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              class="h-7 rounded-md px-2.5 text-xs"
              :disabled="isGenerating || isCompacting || models.length === 0"
              @click="compactContext"
            >
              <Loader2 v-if="isCompacting" class="mr-1.5 size-3.5 animate-spin" />
              <span v-else>整理上下文</span>
            </Button>

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
