<script setup lang="ts">
import type { RenderMessageItem } from './types'

defineProps<{
  messages: RenderMessageItem[]
}>()
</script>

<template>
  <div class="space-y-4">
    <template v-for="(msg, idx) in messages" :key="idx">
      <!-- Narrator -->
      <div
        v-if="msg.role === 'narrator'"
        class="text-sm italic text-muted-foreground leading-relaxed pl-3 border-l-2 border-primary/20 py-1"
      >
        {{ msg.content }}
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
