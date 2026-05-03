<script setup lang="ts">
import { TransitionGroup } from 'vue'
import { Bot, Copy } from 'lucide-vue-next'
import MarkdownRender from 'markstream-vue'
import { relativeTime } from '@/lib/time'
import ThinkingCard from '../ThinkingCard.vue'
import ToolCard from '../ToolCard.vue'
import type { DisplayItem, TurnGroup } from './types'

defineProps<{
  turnGroups: TurnGroup[]
  isDark: boolean
  copiedId: string | null
}>()

const emit = defineEmits<{
  copy: [item: DisplayItem]
}>()
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-4">
    <TransitionGroup name="message-enter" tag="div">
      <div
        v-for="(group, gi) in turnGroups"
        :key="group.turnId"
        :style="{ '--stagger': gi }"
        :class="{ 'cv-auto': gi < turnGroups.length - 1 }"
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
              <span v-else class="text-xs text-muted-foreground/50">
                {{ item.content }}
              </span>
            </div>

            <!-- ASSISTANT AVATAR + BUBBLE (wraps assistant, reasoning, tool_card) -->
            <div
              v-else-if="item.type === 'assistant' || item.type === 'reasoning' || item.type === 'tool_card'"
              class="flex items-start gap-2.5"
            >
              <!-- AI Avatar (hidden on mobile to save horizontal space) -->
              <div
                class="hidden sm:flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20"
              >
                <Bot class="size-3.5" />
              </div>

              <!-- Content area -->
              <div class="min-w-0 flex-1">
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
                    @click="emit('copy', item)"
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

                  <!-- Streaming cursor -->
                  <span
                    v-if="item.isStreaming"
                    class="ml-0.5 inline-block h-[1.15em] w-0.5 animate-pulse rounded-full bg-primary align-text-bottom"
                  />
                </div>

                <!-- Thinking inline -->
                <div v-else-if="item.type === 'reasoning'" class="max-w-[85%]">
                  <ThinkingCard :content="item.content" />
                </div>

                <!-- Tool card -->
                <div v-else-if="item.type === 'tool_card'" class="max-w-[85%]">
                  <ToolCard
                    :tool-name="item.toolName"
                    :raw-arguments="item.rawArguments"
                    :parsed-arguments="item.parsedArguments"
                    :result="item.result"
                    :status="item.status"
                  />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </TransitionGroup>

    <div id="chat-bottom" class="h-px" style="overflow-anchor: auto;" />
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
