<script setup lang="ts">
import { BookOpen, PenLine, BrainCircuit, Clock, Languages } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useStats } from '@/composables/useStats'
import { useLocaleStore } from '@/stores/locale'
import type { SupportedLocale } from '@/db/types'
import { onMounted } from 'vue'

const { t, locale } = useI18n()
const { todayWordCount, todayTokens, loading, durationText } = useStats()
const localeStore = useLocaleStore()

onMounted(() => {
  localeStore.initialize()
})

const availableLocales: { value: SupportedLocale; label: string }[] = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
    <!-- Stats Section -->
    <section>
      <h2 class="text-xs sm:text-sm font-semibold text-muted-foreground mb-2 sm:mb-3 px-1">
        {{ t('my.todayStats') }}
      </h2>
      <div class="grid grid-cols-3 gap-2 sm:gap-3">
        <!-- Words -->
        <div class="rounded-xl border bg-card shadow-sm p-3 sm:p-4">
          <div class="flex items-center gap-3">
            <div
              class="hidden sm:flex size-10 rounded-lg bg-primary/[0.06] items-center justify-center shrink-0"
            >
              <PenLine class="size-4 text-primary/40" />
            </div>
            <div class="min-w-0">
              <p class="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                {{ t('my.todayWriting') }}
              </p>
              <p v-if="loading" class="text-xs sm:text-sm text-muted-foreground/50 mt-0.5">
                {{ t('common.loading') }}
              </p>
              <p v-else class="text-sm sm:text-lg font-bold tabular-nums leading-tight mt-0.5">
                {{ todayWordCount.toLocaleString() }}
              </p>
            </div>
          </div>
        </div>

        <!-- Tokens -->
        <div class="rounded-xl border bg-card shadow-sm p-3 sm:p-4">
          <div class="flex items-center gap-3">
            <div
              class="hidden sm:flex size-10 rounded-lg bg-primary/[0.06] items-center justify-center shrink-0"
            >
              <BrainCircuit class="size-4 text-primary/40" />
            </div>
            <div class="min-w-0">
              <p class="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                {{ t('my.tokenUsage') }}
              </p>
              <p v-if="loading" class="text-xs sm:text-sm text-muted-foreground/50 mt-0.5">
                {{ t('common.loading') }}
              </p>
              <p v-else class="text-sm sm:text-lg font-bold tabular-nums leading-tight mt-0.5">
                {{ todayTokens.toLocaleString() }}
              </p>
            </div>
          </div>
        </div>

        <!-- Usage Time -->
        <div class="rounded-xl border bg-card shadow-sm p-3 sm:p-4">
          <div class="flex items-center gap-3">
            <div
              class="hidden sm:flex size-10 rounded-lg bg-primary/[0.06] items-center justify-center shrink-0"
            >
              <Clock class="size-4 text-primary/40" />
            </div>
            <div class="min-w-0">
              <p class="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                {{ t('my.todayDuration') }}
              </p>
              <p v-if="loading" class="text-xs sm:text-sm text-muted-foreground/50 mt-0.5">
                {{ t('common.loading') }}
              </p>
              <p v-else class="text-xs sm:text-sm font-bold tabular-nums leading-tight mt-0.5">
                {{ durationText }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Language Section -->
    <section class="rounded-xl border bg-card shadow-sm p-5 space-y-3">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Languages class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">{{ t('my.locale.label') }}</h3>
        </div>
        <p class="text-xs text-muted-foreground">{{ t('my.locale.description') }}</p>
      </div>
      <div class="inline-flex rounded-lg border p-0.5 bg-muted/50">
        <button
          v-for="opt in availableLocales"
          :key="opt.value"
          class="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer"
          :class="
            locale === opt.value
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="localeStore.switchLocale(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </section>

    <!-- App Info Card -->
    <section class="rounded-xl border bg-card shadow-sm p-5">
      <div class="flex items-center gap-4">
        <div class="size-11 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
          <BookOpen class="size-5 text-primary/40" />
        </div>
        <div>
          <p class="text-sm font-semibold">{{ t('my.appName') }}</p>
          <p class="text-xs text-muted-foreground">{{ t('my.localMode') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>
