<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Send, Square, Undo2, Redo2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { runAgentLoop } from '@/agent/loop'
import type { Message } from '@/db/types'

const props = defineProps<{
  novelId: string
}>()

const input = ref('')
const messages = ref<Message[]>([])
const isGenerating = ref(false)
const streamingContent = ref('')
const abortController = ref<AbortController | null>(null)

function pushMessage(msg: Message) {
  messages.value.push(msg)
}

function scrollToBottom() {
  nextTick(() => {
    const el = document.getElementById('chat-bottom')
    el?.scrollIntoView({ behavior: 'smooth' })
  })
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
  abortController.value = new AbortController()

  try {
    const result = await runAgentLoop({
      novelId: props.novelId,
      userMessage: text,
      signal: abortController.value.signal,
      onToken(token) {
        streamingContent.value += token
        scrollToBottom()
      },
      onToolCall(name) {
        pushMessage({
          id: crypto.randomUUID(),
          role: 'tool',
          content: `调用工具: ${name}`,
          timestamp: Date.now(),
        })
      },
      onToolResult(name) {
        pushMessage({
          id: crypto.randomUUID(),
          role: 'tool',
          content: `工具 ${name} 执行完成`,
          timestamp: Date.now(),
        })
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

    if (streamingContent.value) {
      pushMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: streamingContent.value,
        timestamp: Date.now(),
      })
    }

    for (const msg of result) {
      if (msg.role === 'tool') {
        pushMessage(msg)
      }
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
    isGenerating.value = false
    abortController.value = null
    scrollToBottom()
  }
}

function cancel() {
  abortController.value?.abort()
}

function undo() {
  // TODO: implement undo via operationHistory
}

function redo() {
  // TODO: implement redo via operationHistory
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
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
                ? 'bg-muted text-muted-foreground text-xs font-mono'
                : 'bg-muted text-foreground'
          "
        >
          {{ msg.content }}
        </div>
      </div>

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

    <div class="shrink-0 border-t bg-background px-3 py-2 space-y-2">
      <div class="flex items-center gap-1">
        <button
          class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
          title="撤销"
          @click="undo"
        >
          <Undo2 class="size-4" />
        </button>
        <button
          class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
          title="重做"
          @click="redo"
        >
          <Redo2 class="size-4" />
        </button>
      </div>

      <div class="flex gap-2">
        <Textarea
          v-model="input"
          placeholder="输入你的想法或反馈..."
          :rows="2"
          class="resize-none min-h-0 flex-1"
          :disabled="isGenerating"
          @keydown.enter.exact.prevent="send"
        />
        <Button
          v-if="!isGenerating"
          size="icon"
          class="shrink-0"
          :disabled="!input.trim()"
          @click="send"
        >
          <Send class="size-4" />
        </Button>
        <Button v-else variant="destructive" size="icon" class="shrink-0" @click="cancel">
          <Square class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
