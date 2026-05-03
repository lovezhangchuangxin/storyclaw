<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import type { Novel } from '@/db/types'
import { relativeTime } from '@/lib/time'

defineProps<{
  novel: Novel
  coverColor: string
}>()

const emit = defineEmits<{
  open: [novel: Novel]
  delete: [novel: Novel]
}>()

function statusLabel(status: string): string {
  if (status === 'completed') return '已完成'
  if (status === 'writing') return '创作中'
  if (status === 'paused') return '已暂停'
  return '草稿'
}

function statusBadgeClass(status: string): string {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
  }
  if (status === 'writing') {
    return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
  }
  if (status === 'paused') {
    return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
  }
  return 'bg-muted text-muted-foreground'
}
</script>

<template>
  <div
    class="relative rounded-xl border bg-card text-left overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 group cursor-pointer"
    role="button"
    tabindex="0"
    @click="emit('open', novel)"
    @keydown.enter="emit('open', novel)"
  >
    <div class="p-4">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="size-2 rounded-full shrink-0" :class="coverColor" />
          <h3 class="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors">
            {{ novel.title || '未命名故事' }}
          </h3>
        </div>
        <button
          class="size-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
          @click.stop="emit('delete', novel)"
          title="删除"
        >
          <Trash2 class="size-3.5" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
        {{ novel.synopsis || '暂无简介' }}
      </p>
      <div class="mt-3 flex items-center justify-between">
        <span class="text-[11px] text-muted-foreground">{{ novel.currentWordCount }} 字</span>
        <span
          class="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          :class="statusBadgeClass(novel.status)"
        >
          {{ statusLabel(novel.status) }}
        </span>
      </div>
      <div class="mt-1 text-[11px] text-muted-foreground/60">
        {{ relativeTime(novel.updatedAt) }}
      </div>
    </div>
  </div>
</template>
