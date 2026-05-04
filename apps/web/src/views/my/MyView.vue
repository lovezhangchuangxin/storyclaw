<script setup lang="ts">
import { BookOpen, PenLine, BrainCircuit, Clock } from 'lucide-vue-next'
import { useStats } from '@/composables/useStats'

const { todayWordCount, todayTokens, loading, durationText } = useStats()
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
    <!-- Stats Section -->
    <section>
      <h2 class="text-xs sm:text-sm font-semibold text-muted-foreground mb-2 sm:mb-3 px-1">
        今日统计
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
              <p class="text-[11px] sm:text-xs text-muted-foreground leading-tight">今日写作</p>
              <p v-if="loading" class="text-xs sm:text-sm text-muted-foreground/50 mt-0.5">
                加载中…
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
              <p class="text-[11px] sm:text-xs text-muted-foreground leading-tight">Token 用量</p>
              <p v-if="loading" class="text-xs sm:text-sm text-muted-foreground/50 mt-0.5">
                加载中…
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
              <p class="text-[11px] sm:text-xs text-muted-foreground leading-tight">今日时长</p>
              <p v-if="loading" class="text-xs sm:text-sm text-muted-foreground/50 mt-0.5">
                加载中…
              </p>
              <p v-else class="text-xs sm:text-sm font-bold tabular-nums leading-tight mt-0.5">
                {{ durationText }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- App Info Card -->
    <section class="rounded-xl border bg-card shadow-sm p-5">
      <div class="flex items-center gap-4">
        <div class="size-11 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
          <BookOpen class="size-5 text-primary/40" />
        </div>
        <div>
          <p class="text-sm font-semibold">StoryClaw</p>
          <p class="text-xs text-muted-foreground">本地模式 · 数据存储在浏览器中</p>
        </div>
      </div>
    </section>
  </div>
</template>
