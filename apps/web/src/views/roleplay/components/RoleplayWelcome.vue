<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Drama } from 'lucide-vue-next'

const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center px-6 py-12">
    <div class="animate-welcome w-full max-w-lg text-center">
      <div class="mb-6 inline-flex">
        <div class="relative">
          <div
            class="flex size-16 items-center justify-center rounded-lg bg-primary/8 ring-1 ring-primary/10 dark:bg-primary/15 dark:ring-primary/20"
          >
            <Drama class="size-7 text-primary/70" />
          </div>
        </div>
      </div>

      <h2 class="mb-2 text-xl font-semibold tracking-tight text-foreground">
        {{ t('roleplay.agent.welcome.greeting') }}
      </h2>
      <p class="text-sm text-muted-foreground">{{ t('roleplay.agent.welcome.hint') }}</p>
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
