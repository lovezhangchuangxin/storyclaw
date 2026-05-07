<script setup lang="ts">
import type { RenderMessageItem } from './types'

defineProps<{
  messages: RenderMessageItem[]
}>()
</script>

<template>
  <div class="space-y-2.5">
    <template v-for="(msg, idx) in messages" :key="idx">
      <div
        v-if="msg.role === 'narrator'"
        class="text-sm italic text-muted-foreground leading-relaxed pl-3 border-l-2 border-border/50"
      >
        {{ msg.content }}
      </div>

      <div v-else-if="msg.role === 'character'" class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-primary/80">{{ msg.characterName }}</span>
        <div v-if="msg.emote" class="text-xs italic text-muted-foreground/60">
          *{{ msg.emote }}*
        </div>
        <div class="text-sm leading-relaxed bg-muted/50 rounded-lg px-3 py-2 max-w-[90%]">
          {{ msg.content }}
        </div>
      </div>

      <div v-else-if="msg.role === 'system'" class="flex items-center gap-3 py-1">
        <div class="h-px flex-1 bg-border/40" />
        <span class="text-xs text-muted-foreground/60 shrink-0">{{ msg.content }}</span>
        <div class="h-px flex-1 bg-border/40" />
      </div>
    </template>
  </div>
</template>
