<script setup lang="ts">
import { computed } from 'vue'
import type { RenderMessageItem } from './types'

const props = defineProps<{
  messages: RenderMessageItem[]
}>()

interface ContentSegment {
  type: 'bracket' | 'text'
  text: string
}

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const regex = /（[^）]*）/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: content.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'bracket', text: match[0] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', text: content.slice(lastIndex) })
  }

  return segments
}

const parsedMessages = computed(() =>
  props.messages.map((msg) => ({
    ...msg,
    segments: msg.role === 'character' ? parseContent(msg.content) : null,
  })),
)
</script>

<template>
  <div class="space-y-4">
    <template v-for="(msg, idx) in parsedMessages" :key="idx">
      <!-- Narrator -->
      <div
        v-if="msg.role === 'narrator'"
        class="text-sm italic text-muted-foreground leading-relaxed pl-3 border-l-2 border-primary/20 py-1"
      >
        {{ msg.content }}
      </div>

      <!-- Character -->
      <div v-else-if="msg.role === 'character'" class="flex flex-col gap-0.5 max-w-[90%]">
        <span class="text-xs font-semibold text-primary/70">{{ msg.characterName }}</span>
        <div
          class="text-sm leading-relaxed whitespace-pre-wrap break-words rounded-lg bg-muted/50 px-3 py-2"
        >
          <template v-for="(seg, si) in msg.segments" :key="si">
            <span v-if="seg.type === 'bracket'" class="italic text-muted-foreground/80">
              {{ seg.text }}
            </span>
            <span v-else>{{ seg.text }}</span>
          </template>
        </div>
      </div>

      <!-- System (scene transition) -->
      <div v-else-if="msg.role === 'system'" class="flex items-center gap-3 py-1">
        <div class="h-px flex-1 bg-border/40" />
        <span class="text-xs text-muted-foreground/60 shrink-0">{{ msg.content }}</span>
        <div class="h-px flex-1 bg-border/40" />
      </div>
    </template>
  </div>
</template>
