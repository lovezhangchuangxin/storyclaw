<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { ChevronDown, Copy, Send, Square, BrainCircuit } from 'lucide-vue-next'
import { TransitionGroup } from 'vue'
import { parseJSON } from 'partial-json'
import { runRoleplayLoop, resumeFromChoice } from '@/agent/roleplay-loop'
import { cloneMessages, completeAssistantToolUse } from '@/agent/message-state'
import { estimateMessagesTokens } from '@/agent/token-estimator'
import type { AssistantMessage, Message, ModelConfig } from '@/db/types'
import { getConfig } from '@/db/config'
import { getAllModels } from '@/composables/useModels'
import { getRoleplayConversationBySessionId } from '@/db/roleplay-conversations'
import { getRoleplaySessionById } from '@/db/roleplay-sessions'
import { getPromptById } from '@/db/prompts'
import { uuid } from '@/lib/utils'
import { modelLabel } from '@/lib/model-utils'
import type { RoleplaySidebarData } from '@/db/roleplay-types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ContextWindowIndicator from '@/views/story/components/agent/ContextWindowIndicator.vue'
import RoleplayWelcome from './RoleplayWelcome.vue'
import RoleplayMessageRenderer from './RoleplayMessageRenderer.vue'
import ChoiceButtons from './ChoiceButtons.vue'
import type { RoleplayDisplayItem, RoleplayTurnGroup, RenderMessageItem, ChoiceItem } from './types'

const props = defineProps<{
  sessionId: string
}>()

const emit = defineEmits<{
  'sidebar-update': [data: RoleplaySidebarData]
}>()

const { t } = useI18n()

// ---- State ----
const input = ref('')
const promptName = ref('')
const persistedMessages = ref<Message[]>([])
const unsavedMessages = ref<Message[]>([])
const localStatusMessages = ref<Message[]>([])
const transientMessages = ref<Message[]>([])
const isGenerating = ref(false)
const awaitingChoice = ref(false)
const pendingChoiceToolCallId = ref<string | null>(null)
const abortController = ref<AbortController | null>(null)
const sidebarData = ref<RoleplaySidebarData | null>(null)
let activeRequestId = 0
let activeConversationLoadId = 0
let initialMessageSent = false

const models = ref<ModelConfig[]>([])
const selectedModelId = ref('')

const selectedModel = computed(() => models.value.find((m) => m.id === selectedModelId.value))
const isChoiceLoading = computed(() => {
  if (awaitingChoice.value || pendingChoiceToolCallId.value) return false
  for (const item of displayItems.value) {
    if (item.type === 'roleplay_choice' && item.status === 'pending') return true
  }
  return false
})

const lastUsageInfo = ref<{ promptTokens?: number; cachedTokens?: number } | null>(null)
const contextUsedTokens = computed(() => {
  if (lastUsageInfo.value?.promptTokens != null) return lastUsageInfo.value.promptTokens
  if (timelineMessages.value.length === 0) return 0
  return estimateMessagesTokens(timelineMessages.value)
})
const contextIsEstimated = computed(
  () => lastUsageInfo.value?.promptTokens == null && timelineMessages.value.length > 0,
)
const lastCachedTokens = computed(() => lastUsageInfo.value?.cachedTokens ?? undefined)

const historyMessages = computed(() => [...persistedMessages.value, ...unsavedMessages.value])
const timelineMessages = computed(() => [
  ...historyMessages.value,
  ...localStatusMessages.value,
  ...transientMessages.value,
])

// ---- Display items ----
function getStreamingAssistantMessage(messages: Message[]): AssistantMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'assistant') return messages[i] as AssistantMessage
  }
  return null
}

function getLastTextPartIndex(message: AssistantMessage): number {
  for (let i = message.parts.length - 1; i >= 0; i--) {
    if (message.parts[i]?.type === 'text') return i
  }
  return -1
}

function isSameAssistantMessage(a: AssistantMessage, b: AssistantMessage): boolean {
  return a.id === b.id
}

function buildRoleplayDisplayItems(messages: Message[]): RoleplayDisplayItem[] {
  const items: RoleplayDisplayItem[] = []
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
          kind: (message as any).kind,
        })
        break
      case 'assistant': {
        const assistant = message as AssistantMessage
        for (const [index, part] of assistant.parts.entries()) {
          const id = `${assistant.id}:${index}`

          if (part.type === 'text' && part.text.trim()) {
            items.push({
              type: 'assistant',
              id,
              content: part.text,
              timestamp: assistant.timestamp,
              isStreaming:
                !!streamingAssistant &&
                isSameAssistantMessage(assistant, streamingAssistant) &&
                index === getLastTextPartIndex(streamingAssistant),
            })
          } else if (part.type === 'tool_use') {
            if (part.toolName === 'render_message') {
              // Try full parse first, then partial parse for streaming
              const args =
                part.arguments ?? (part.rawArguments ? parseJSON(part.rawArguments) : null)
              const messages = args?.messages as RenderMessageItem[] | undefined
              if (messages?.length) {
                items.push({
                  type: 'roleplay_messages',
                  id,
                  messages,
                  timestamp: assistant.timestamp,
                  status: part.status,
                })
              }
            } else if (part.toolName === 'render_choice') {
              const args =
                part.arguments ?? (part.rawArguments ? parseJSON(part.rawArguments) : null)
              if (args) {
                items.push({
                  type: 'roleplay_choice',
                  id,
                  toolCallId: part.toolCallId,
                  prompt: (args.prompt as string) || '',
                  choices: (args.choices as ChoiceItem[]) || [],
                  allowFreeText: (args.allowFreeText as boolean) ?? true,
                  timestamp: assistant.timestamp,
                  status: part.status,
                })
              }
            }
          }
        }
        break
      }
    }
  }

  return items
}

const displayItems = computed(() => buildRoleplayDisplayItems(timelineMessages.value))

const turnGroups = computed<RoleplayTurnGroup[]>(() => {
  const groups: RoleplayTurnGroup[] = []
  let currentGroup: RoleplayTurnGroup | null = null

  for (const item of displayItems.value) {
    if (item.type === 'user') {
      if (currentGroup) groups.push(currentGroup)
      currentGroup = { turnId: item.id, timestamp: item.timestamp, items: [item] }
    } else if (currentGroup) {
      currentGroup.items.push(item)
    } else {
      currentGroup = { turnId: item.id, timestamp: item.timestamp, items: [item] }
    }
  }

  if (currentGroup) groups.push(currentGroup)
  return groups
})

// ---- Scroll ----
const messagesContainer = ref<HTMLElement | null>(null)
const bottomAnchor = ref<HTMLElement | null>(null)
const isNearBottom = ref(true)

function checkScrollPosition() {
  const el = messagesContainer.value
  if (!el) return
  isNearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

let lastAutoScrollTime = 0
function scrollToBottom(smooth = false) {
  if (!isNearBottom.value) return
  if (!smooth) {
    const now = performance.now()
    if (now - lastAutoScrollTime < 30) return
    lastAutoScrollTime = now
  }
  nextTick(() => {
    if (!isNearBottom.value) return
    bottomAnchor.value?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'end' })
  })
}

function forceScrollToBottom() {
  nextTick(() => {
    bottomAnchor.value?.scrollIntoView({ behavior: 'instant', block: 'end' })
    isNearBottom.value = true
  })
}

// ---- Loading ----
async function loadModels() {
  const config = await getConfig()
  models.value = await getAllModels()
  const defaultExists = models.value.some((m) => m.id === config.defaultModelId)
  selectedModelId.value = defaultExists ? config.defaultModelId : models.value[0]?.id || ''
}

async function loadConversation() {
  const loadId = ++activeConversationLoadId
  const sessionId = props.sessionId
  const conversation = await getRoleplayConversationBySessionId(sessionId)
  if (loadId !== activeConversationLoadId || sessionId !== props.sessionId) return
  persistedMessages.value = conversation?.messages ?? []
  unsavedMessages.value = []
  localStatusMessages.value = []

  // Restore awaiting_choice state if last assistant has a completed render_choice
  restoreChoiceState(persistedMessages.value)
}

function updateTokenUsage(messages: Message[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      const a = messages[i] as AssistantMessage
      if (a.promptTokens != null) {
        lastUsageInfo.value = { promptTokens: a.promptTokens, cachedTokens: a.cachedTokens }
        return
      }
    }
  }
}

function restoreChoiceState(messages: Message[]) {
  // Find the last assistant message with a completed render_choice
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant') {
      const assistant = msg as AssistantMessage
      for (const part of assistant.parts) {
        if (
          part.type === 'tool_use' &&
          part.toolName === 'render_choice' &&
          part.status === 'completed'
        ) {
          // Check if there's a user message after this assistant (choice already made)
          const assistantIdx = messages.indexOf(msg)
          const hasUserAfter = messages.slice(assistantIdx + 1).some((m) => m.role === 'user')
          if (!hasUserAfter) {
            awaitingChoice.value = true
            pendingChoiceToolCallId.value = part.toolCallId
          }
          return
        }
      }
      return // Found assistant but no render_choice — stop looking
    }
  }
}

function resetTransientState() {
  transientMessages.value = []
  isGenerating.value = false
  abortController.value = null
}

function pushLocalStatus(kind: 'error' | 'warning' | 'info' | 'cancelled', content: string) {
  localStatusMessages.value.push({
    id: uuid(),
    role: 'status',
    kind,
    content,
    timestamp: Date.now(),
  })
}

// ---- Send ----
async function send() {
  const text = input.value.trim()
  if (!text || isGenerating.value) return

  // If awaiting choice, treat input as free text resume
  if (awaitingChoice.value) {
    input.value = ''
    await handleFreeText(text)
    return
  }

  input.value = ''
  transientMessages.value = []
  isGenerating.value = true
  abortController.value = new AbortController()
  const requestId = ++activeRequestId
  const baseUnsavedMessages = cloneMessages(unsavedMessages.value)
  const baseHistoryMessages = cloneMessages(historyMessages.value)
  await nextTick()

  let needsForceScroll = true

  try {
    const result = await runRoleplayLoop({
      sessionId: props.sessionId,
      userMessage: text,
      modelConfigId: selectedModelId.value,
      historyMessages: baseHistoryMessages,
      signal: abortController.value.signal,
      onMessagesUpdated(messages) {
        if (requestId !== activeRequestId) return
        transientMessages.value = messages
        if (needsForceScroll) {
          needsForceScroll = false
          nextTick(() => forceScrollToBottom())
        } else if (isNearBottom.value) {
          scrollToBottom()
        }
      },
      onSidebarUpdate(data) {
        sidebarData.value = data
        emit('sidebar-update', data)
      },
      onError(error) {
        if (requestId !== activeRequestId) return
        toast.error(t('story.agent.generationFailed'), { description: error })
      },
    })

    if (requestId !== activeRequestId) return

    transientMessages.value = result.messages
    updateTokenUsage(result.messages)

    if (result.persisted) {
      persistedMessages.value = [...baseHistoryMessages, ...result.messages]
      unsavedMessages.value = []
      localStatusMessages.value = []
      transientMessages.value = []
    } else {
      unsavedMessages.value = [...baseUnsavedMessages, ...result.messages]
      transientMessages.value = []
      if (result.persistenceError) {
        pushLocalStatus('error', `${t('story.agent.saveFailed')}：${result.persistenceError}`)
      }
    }

    if (result.status === 'awaiting_choice' && result.pendingChoiceToolCallId) {
      pendingChoiceToolCallId.value = result.pendingChoiceToolCallId
      awaitingChoice.value = true
    }
  } catch (error) {
    if (requestId !== activeRequestId) return
    pushLocalStatus('error', error instanceof Error ? error.message : String(error))
    toast.error(t('story.agent.generationFailed'), {
      description: error instanceof Error ? error.message : String(error),
    })
  } finally {
    if (requestId === activeRequestId) {
      isGenerating.value = false
      abortController.value = null
      if (isNearBottom.value) scrollToBottom(true)
    }
  }
}

// ---- Choice handling ----
function findChoiceAssistant(messages: Message[], toolCallId: string): AssistantMessage | null {
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      for (const part of (msg as AssistantMessage).parts) {
        if (part.type === 'tool_use' && part.toolCallId === toolCallId) {
          return msg as AssistantMessage
        }
      }
    }
  }
  return null
}

async function handleChoiceSelect(choiceId: string, choiceText: string) {
  await resumeChoice(choiceId, choiceText, undefined)
}

async function handleFreeText(text: string) {
  await resumeChoice(null, undefined, text)
}

async function resumeChoice(
  selectedChoiceId: string | null,
  selectedChoiceText?: string,
  freeTextInput?: string,
) {
  if (!pendingChoiceToolCallId.value) return

  const toolCallId = pendingChoiceToolCallId.value

  // Complete the choice tool in persisted messages for immediate UI update
  const originalAssistant = findChoiceAssistant(persistedMessages.value, toolCallId)
  if (originalAssistant) {
    const result = selectedChoiceId
      ? JSON.stringify({ selectedChoiceId, selectedChoiceText })
      : JSON.stringify({ selectedChoiceId: null, freeTextInput })
    completeAssistantToolUse(originalAssistant, toolCallId, result, 'completed')
  }

  pendingChoiceToolCallId.value = null
  awaitingChoice.value = false
  isGenerating.value = true
  abortController.value = new AbortController()
  const requestId = ++activeRequestId

  forceScrollToBottom()

  try {
    const historyMessages = cloneMessages([...persistedMessages.value, ...unsavedMessages.value])
    const clonedAssistant = findChoiceAssistant(historyMessages, toolCallId)

    if (!clonedAssistant) {
      isGenerating.value = false
      abortController.value = null
      return
    }

    const turnMessages: Message[] = []

    const result = await resumeFromChoice({
      sessionId: props.sessionId,
      selectedChoiceId,
      selectedChoiceText,
      freeTextInput,
      choiceToolCallId: toolCallId,
      assistantMessage: clonedAssistant,
      turnMessages,
      historyMessages,
      modelConfigId: selectedModelId.value,
      signal: abortController.value.signal,
      onMessagesUpdated(messages) {
        if (requestId !== activeRequestId) return
        transientMessages.value = messages
        if (isNearBottom.value) scrollToBottom()
      },
      onSidebarUpdate(data) {
        sidebarData.value = data
        emit('sidebar-update', data)
      },
      onError(error) {
        if (requestId !== activeRequestId) return
        toast.error(t('story.agent.generationFailed'), { description: error })
      },
    })

    if (requestId !== activeRequestId) return

    transientMessages.value = result.messages
    updateTokenUsage(result.messages)

    if (result.persisted) {
      persistedMessages.value = [...historyMessages, ...result.messages]
      unsavedMessages.value = []
      localStatusMessages.value = []
      transientMessages.value = []
    } else {
      unsavedMessages.value = [...unsavedMessages.value, ...result.messages]
      transientMessages.value = []
      if (result.persistenceError) {
        pushLocalStatus('error', `${t('story.agent.saveFailed')}：${result.persistenceError}`)
      }
    }

    if (result.status === 'awaiting_choice' && result.pendingChoiceToolCallId) {
      pendingChoiceToolCallId.value = result.pendingChoiceToolCallId
      awaitingChoice.value = true
    }
  } catch (error) {
    if (requestId !== activeRequestId) return
    pushLocalStatus('error', error instanceof Error ? error.message : String(error))
    toast.error(t('story.agent.generationFailed'), {
      description: error instanceof Error ? error.message : String(error),
    })
  } finally {
    if (requestId === activeRequestId) {
      isGenerating.value = false
      abortController.value = null
      if (isNearBottom.value) scrollToBottom(true)
    }
  }
}

function cancel() {
  abortController.value?.abort()
}

// ---- Copy ----
const copiedId = ref<string | null>(null)
async function copyAssistantText(item: RoleplayDisplayItem) {
  if (item.type !== 'assistant') return
  try {
    await navigator.clipboard.writeText(item.content)
    copiedId.value = item.id
    setTimeout(() => {
      if (copiedId.value === item.id) copiedId.value = null
    }, 2000)
  } catch {
    toast.error(t('story.agent.copyFailed'))
  }
}

// ---- Lifecycle ----
async function reloadForSession() {
  activeRequestId++
  abortController.value?.abort()
  resetTransientState()
  awaitingChoice.value = false
  pendingChoiceToolCallId.value = null
  await loadConversation()
  forceScrollToBottom()
}

onMounted(async () => {
  await loadModels()
  await loadConversation()
  forceScrollToBottom()

  // Load prompt name for character header
  const session = await getRoleplaySessionById(props.sessionId)
  if (session) {
    const prompt = await getPromptById(session.promptId)
    if (prompt) {
      promptName.value = prompt.name.split('·')[0].trim()
    }
  }

  // Auto-send initial message if conversation is empty
  if (persistedMessages.value.length === 0 && !initialMessageSent) {
    initialMessageSent = true
    if (session) {
      const prompt = await getPromptById(session.promptId)
      if (prompt?.initialMessage) {
        input.value = prompt.initialMessage
        await nextTick()
        send()
      }
    }
  }
})

onUnmounted(() => {
  const el = messagesContainer.value
  if (el) el.removeEventListener('scroll', checkScrollPosition)
})

watch(messagesContainer, (el, oldEl) => {
  if (oldEl) oldEl.removeEventListener('scroll', checkScrollPosition)
  if (el) el.addEventListener('scroll', checkScrollPosition, { passive: true })
})

watch(
  () => props.sessionId,
  async () => {
    initialMessageSent = false
    await reloadForSession()
  },
)
</script>

<template>
  <div class="relative flex h-full flex-col bg-background/65">
    <!-- Messages area -->
    <div
      ref="messagesContainer"
      class="chat-messages flex-1 overflow-y-auto overscroll-none [overflow-anchor:none]"
    >
      <RoleplayWelcome v-if="displayItems.length === 0" />
      <div v-else class="mx-auto max-w-3xl px-4 py-4">
        <TransitionGroup name="message-enter" tag="div" class="space-y-4">
          <div
            v-for="(group, gi) in turnGroups"
            :key="group.turnId"
            :style="{ '--stagger': gi }"
            :class="{ 'cv-auto': gi < turnGroups.length - 1 }"
          >
            <!-- Items in this turn -->
            <div class="space-y-2">
              <template v-for="item in group.items" :key="item.id">
                <!-- USER -->
                <div v-if="item.type === 'user'" class="flex justify-end">
                  <div class="max-w-[75%]">
                    <div
                      class="rounded-lg rounded-br-sm bg-primary px-4 py-1.5 text-sm leading-relaxed text-primary-foreground shadow-sm"
                    >
                      {{ item.content }}
                    </div>
                  </div>
                </div>

                <!-- STATUS -->
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
                    <span class="line-through decoration-muted-foreground/30">{{
                      item.content
                    }}</span>
                    <span class="ml-0.5">┄</span>
                  </div>
                  <span v-else class="text-xs text-muted-foreground/50">{{ item.content }}</span>
                </div>

                <!-- ASSISTANT TEXT (plain text with character name) -->
                <div v-else-if="item.type === 'assistant'" class="max-w-[85%]">
                  <span v-if="promptName" class="text-xs font-semibold text-primary/80 mb-1 block">
                    {{ promptName }}
                  </span>
                  <div class="group relative rounded-lg border bg-card px-4 py-2 shadow-sm">
                    <button
                      v-if="item.content"
                      class="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      :class="{ 'opacity-100 text-foreground': copiedId === item.id }"
                      @click="copyAssistantText(item)"
                    >
                      <Copy class="size-3.5" />
                    </button>
                    <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {{ item.content }}
                    </p>
                    <span
                      v-if="item.isStreaming"
                      class="ml-0.5 inline-block h-[1.15em] w-0.5 animate-pulse rounded-full bg-primary align-text-bottom"
                    />
                  </div>
                </div>

                <!-- ROLEPLAY MESSAGES (render_message) -->
                <div v-else-if="item.type === 'roleplay_messages'">
                  <RoleplayMessageRenderer :messages="item.messages" />
                </div>

                <!-- ROLEPLAY CHOICE (render_choice) — only show current pending choice -->
                <div
                  v-else-if="
                    item.type === 'roleplay_choice' &&
                    item.toolCallId === pendingChoiceToolCallId &&
                    awaitingChoice
                  "
                >
                  <ChoiceButtons
                    :prompt="item.prompt"
                    :choices="item.choices"
                    :disabled="isGenerating"
                    @select="handleChoiceSelect"
                  />
                </div>
              </template>

              <!-- Choice loading skeleton: shown while render_choice is streaming -->
              <div
                v-if="gi === turnGroups.length - 1 && isChoiceLoading"
                class="rounded-lg border bg-card p-3 shadow-sm space-y-2"
              >
                <div class="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div class="space-y-1.5 pt-1">
                  <div class="h-[38px] w-full animate-pulse rounded-md bg-muted" />
                  <div class="h-[38px] w-full animate-pulse rounded-md bg-muted" />
                  <div class="h-[38px] w-2/3 animate-pulse rounded-md bg-muted" />
                </div>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
      <div ref="bottomAnchor" />
    </div>

    <!-- Scroll-to-bottom button -->
    <div
      v-if="!isNearBottom && displayItems.length > 0"
      class="pointer-events-none absolute bottom-20 right-6 z-10"
    >
      <button
        class="pointer-events-auto flex size-8 items-center justify-center rounded-full border bg-card shadow-md transition-all hover:bg-muted hover:shadow-lg"
        @click="forceScrollToBottom"
      >
        <ChevronDown class="size-4 text-muted-foreground" />
      </button>
    </div>

    <!-- Input area (always visible) -->
    <div class="shrink-0 bg-background/90 backdrop-blur-sm">
      <div class="mx-auto max-w-3xl px-4 pb-4 pt-2">
        <div
          class="rounded-lg border bg-card shadow-lg transition-all focus-within:border-ring/50 focus-within:shadow-xl"
        >
          <textarea
            :value="input"
            @input="input = ($event.target as HTMLTextAreaElement).value"
            :placeholder="t('roleplay.agent.inputPlaceholder')"
            rows="1"
            class="field-sizing-content block min-h-0 w-full resize-none bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            :disabled="isGenerating"
            @keydown.enter.exact.prevent="send"
          />
          <div class="flex items-center gap-2 px-3 pb-3">
            <!-- Model selector dropdown -->
            <DropdownMenu v-if="models.length > 0">
              <DropdownMenuTrigger
                as="button"
                class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span
                  class="flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70"
                >
                  {{ selectedModel?.provider?.[0]?.toUpperCase() ?? '?' }}
                </span>
                <span class="max-w-[120px] truncate">{{ modelLabel(selectedModel!) }}</span>
                <ChevronDown class="size-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" class="min-w-[200px]">
                <DropdownMenuItem
                  v-for="model in models"
                  :key="model.id"
                  class="flex items-center gap-2"
                  @click="selectedModelId = model.id"
                >
                  <span
                    class="flex size-5 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70"
                  >
                    {{ model.provider?.[0]?.toUpperCase() ?? '?' }}
                  </span>
                  <span class="text-xs">{{ modelLabel(model) }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <router-link
              v-else
              :to="{ name: 'model-config' }"
              class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <BrainCircuit class="size-3.5" />
              <span>{{ t('story.agent.configureModel') }}</span>
            </router-link>

            <div class="ml-auto flex items-center gap-1">
              <ContextWindowIndicator
                :used-tokens="contextUsedTokens"
                :context-window-tokens="selectedModel?.contextWindowTokens ?? 0"
                :output-reserve-tokens="selectedModel?.outputReserveTokens ?? 0"
                :compaction-trigger-ratio="selectedModel?.compactionTriggerRatio ?? 0.7"
                :message-count="timelineMessages.length"
                :is-estimated="contextIsEstimated"
                :cached-tokens="lastCachedTokens"
              />
              <Button
                v-if="!isGenerating"
                size="sm"
                class="gap-1.5"
                :disabled="!input.trim()"
                @click="send"
              >
                <Send class="size-3.5" />
                {{ t('story.agent.send') }}
              </Button>
              <Button v-else variant="destructive" size="icon-sm" @click="cancel">
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

.cv-auto {
  content-visibility: auto;
  contain-intrinsic-size: 0 200px;
}
</style>
