<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen } from 'lucide-vue-next'

const { t } = useI18n()

const emit = defineEmits<{
  fill: [value: string]
}>()

const suggestions = computed(() => [
  {
    icon: '✨',
    label: t('story.agent.welcome.suggestion1'),
    prompt: t('story.agent.welcome.suggestion1Prompt'),
  },
  {
    icon: '🎭',
    label: t('story.agent.welcome.suggestion2'),
    prompt: t('story.agent.welcome.suggestion2Prompt'),
  },
  {
    icon: '📖',
    label: t('story.agent.welcome.suggestion3'),
    prompt: t('story.agent.welcome.suggestion3Prompt'),
  },
])
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
      <h2 class="mb-2 text-xl font-semibold tracking-tight text-foreground">
        {{ t('story.agent.welcome.greeting') }}
      </h2>
      <p class="mb-8 text-sm text-muted-foreground">{{ t('story.agent.welcome.hint') }}</p>

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
