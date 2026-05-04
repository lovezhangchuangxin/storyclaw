<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'

const emit = defineEmits<{
  fill: [value: string]
}>()

const suggestions = [
  {
    icon: '✨',
    label: '告诉我你想要什么样的故事...',
    prompt: '告诉我你想要什么样的故事，我来帮你创作。',
  },
  { icon: '🎭', label: '帮我设计角色和世界观', prompt: '帮我设计一个故事的角色和世界观。' },
  { icon: '📖', label: '写一个章节让我看看', prompt: '写一个章节让我看看你的写作能力。' },
]
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center px-6 py-12">
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
      <h2 class="mb-2 text-xl font-semibold tracking-tight text-foreground">开始创作你的故事</h2>
      <p class="mb-8 text-sm text-muted-foreground">告诉我你的想法，我会帮你将灵感变为文字</p>

      <!-- Suggestion chips -->
      <div class="flex flex-col gap-2.5">
        <button
          v-for="s in suggestions"
          :key="s.label"
          class="group flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 text-left text-sm text-muted-foreground shadow-xs transition-all hover:border-primary/30 hover:bg-primary/3 hover:text-foreground hover:shadow-sm"
          @click="emit('fill', s.prompt)"
        >
          <span class="text-base">{{ s.icon }}</span>
          <span class="leading-snug">{{ s.label }}</span>
          <span
            class="ml-auto shrink-0 text-xs text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
          >
            ↵
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
