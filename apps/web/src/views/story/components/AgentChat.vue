<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { runAgentLoop } from '@/agent/loop'
import { cloneMessages } from '@/agent/message-state'
import { compactConversationContext } from '@/agent/context-compaction'
import { loadStoryState } from '@/agent/story-state'
import { getConfig } from '@/db/config'
import { getAllModels } from '@/composables/useModels'
import { deleteConversation, getConversationByNovelId } from '@/db/conversations'
import { deleteContextSnapshotsByNovelId } from '@/db/context-snapshots'
import type {
  AssistantMessage,
  AssistantPart,
  Message,
  ModelConfig,
  StatusMessage,
} from '@/db/types'
import AgentWelcome from './agent/AgentWelcome.vue'
import AgentMessageList from './agent/AgentMessageList.vue'
import AgentInputBar from './agent/AgentInputBar.vue'
import type { DisplayItem, TurnGroup } from './agent/types'

const props = defineProps<{
  novelId: string
}>()

const { t } = useI18n()

const input = ref('')
const persistedMessages = ref<Message[]>([])
const unsavedMessages = ref<Message[]>([])
const localStatusMessages = ref<StatusMessage[]>([])
const transientMessages = ref<Message[]>([])
const isGenerating = ref(false)
const isCompacting = ref(false)
const abortController = ref<AbortController | null>(null)
const isDark = computed(() => document.documentElement.classList.contains('dark'))
let activeRequestId = 0
let activeConversationLoadId = 0

const models = ref<ModelConfig[]>([])
const selectedModelId = ref('')

const selectedModelLabel = computed(() => {
  const model = models.value.find((item) => item.id === selectedModelId.value)
  return model ? model.model : t('story.agent.selectModel')
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
        !!streamingAssistant &&
        isSameAssistantMessage(message, streamingAssistant) &&
        index === getLastTextPartIndex(streamingAssistant),
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
  models.value = await getAllModels()
  // Validate that defaultModelId still exists in available models
  const defaultExists = models.value.some((m) => m.id === config.defaultModelId)
  selectedModelId.value = defaultExists ? config.defaultModelId : models.value[0]?.id || ''
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

let lastAutoScrollTime = 0
function scrollToBottom(smooth = false) {
  if (!isNearBottom.value) return
  // Throttle instant scrolls during streaming to avoid layout jank.
  // Smooth scrolls (final completion) always fire.
  if (!smooth) {
    const now = performance.now()
    if (now - lastAutoScrollTime < 30) return
    lastAutoScrollTime = now
  }
  nextTick(() => {
    if (!isNearBottom.value) return
    const el = messagesContainer.value
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  })
}

function forceScrollToBottom() {
  const el = messagesContainer.value
  if (el) el.scrollTop = el.scrollHeight
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

watch(
  () => props.novelId,
  async () => {
    await reloadForNovel()
  },
)

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
  await nextTick()
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
        toast.error(t('story.agent.generationFailed'), { description: error })
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
        pushLocalStatus('error', `${t('story.agent.saveFailed')}：${result.persistenceError}`)
        toast.error(t('story.agent.conversationNotSaved'), {
          description: result.persistenceError,
        })
      }
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

function handleCommand(cmdId: string) {
  const handlers: Record<string, () => void> = {
    compact: compactContext,
    new: newConversation,
  }
  if (handlers[cmdId]) {
    handlers[cmdId]()
  } else {
    toast.error(`${t('story.agent.unknownCommand')}：/${cmdId}`)
  }
}

async function newConversation() {
  if (isGenerating.value) return
  try {
    await deleteConversation(props.novelId)
    await deleteContextSnapshotsByNovelId(props.novelId)
    persistedMessages.value = []
    unsavedMessages.value = []
    localStatusMessages.value = []
    transientMessages.value = []
    toast.success(t('story.agent.sessionCreated'))
    pushLocalStatus('info', t('story.agent.newSessionCreatedDesc'))
  } catch (error) {
    toast.error(t('story.agent.newConversationFailed'), {
      description: error instanceof Error ? error.message : String(error),
    })
  }
}

async function compactContext() {
  if (isGenerating.value || isCompacting.value) return
  const model = models.value.find((item) => item.id === selectedModelId.value) ?? models.value[0]
  if (!model) {
    toast.error(t('story.agent.pleaseConfigureModel'))
    return
  }

  isCompacting.value = true
  try {
    const conversation = await getConversationByNovelId(props.novelId)
    const result = await compactConversationContext({
      novelId: props.novelId,
      modelConfig: model,
      conversation: conversation ?? { novelId: props.novelId, messages: [], updatedAt: Date.now() },
      storyState: await loadStoryState(props.novelId),
      reason: 'manual',
      force: true,
    })

    if (result.snapshot) {
      const msg = `${t('story.agent.contextCompacted')}：${t('story.agent.compactionBefore')} ${result.estimatedInputTokensBefore} token，${t('story.agent.compactionAfter')} ${result.estimatedInputTokensAfter} token`
      toast.success(t('story.agent.contextCompacted'))
      pushLocalStatus('info', msg)
    } else {
      toast.success(t('story.agent.noCompactionNeeded'))
      pushLocalStatus('info', t('story.agent.noContextToCompact'))
    }
  } catch (error) {
    toast.error(t('story.agent.compactionFailed'), {
      description: error instanceof Error ? error.message : String(error),
    })
    pushLocalStatus(
      'error',
      `${t('story.agent.compactionFailed')}：${error instanceof Error ? error.message : String(error)}`,
    )
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
    setTimeout(() => {
      if (copiedId.value === item.id) copiedId.value = null
    }, 2000)
  } catch {
    toast.error(t('story.agent.copyFailed'))
  }
}

// ---- Welcome fill handler ----
function onWelcomeFill(prompt: string) {
  input.value = prompt
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-background/65">
    <!-- Messages area -->
    <div
      ref="messagesContainer"
      class="chat-messages flex-1 overflow-y-auto overscroll-none [overflow-anchor:none]"
    >
      <AgentWelcome v-if="displayItems.length === 0" @fill="onWelcomeFill" />
      <AgentMessageList
        v-else
        :turn-groups="turnGroups"
        :is-dark="isDark"
        :copied-id="copiedId"
        @copy="copyAssistantText"
      />
    </div>

    <!-- Scroll-to-bottom button -->
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

    <AgentInputBar
      :model-value="input"
      :models="models"
      :selected-model-id="selectedModelId"
      :is-generating="isGenerating || isCompacting"
      :selected-model-label="selectedModelLabel"
      :selected-model-provider="selectedModelProvider"
      @update:model-value="input = $event"
      @send="send"
      @cancel="cancel"
      @command="handleCommand"
      @update:selected-model-id="selectedModelId = $event"
    />
  </div>
</template>
