<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import type { Novel } from '@/db/types'
import { relativeTime } from '@/lib/time'

defineProps<{
  novel: Novel
  chapterCount: number
  coverColor: string
}>()

const emit = defineEmits<{
  open: [novel: Novel]
  delete: [novel: Novel]
}>()
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
          <h3
            class="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors"
          >
            {{ novel.title || $t('home.card.untitled') }}
          </h3>
        </div>
        <button
          class="size-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
          @click.stop="emit('delete', novel)"
          :title="$t('common.delete')"
        >
          <Trash2 class="size-3.5" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
        {{ novel.synopsis || $t('home.card.noSynopsis') }}
      </p>
      <div class="mt-3 flex items-center justify-between">
        <span class="text-[11px] text-muted-foreground">{{
          $t('home.card.words', { words: novel.currentWordCount, chapters: chapterCount })
        }}</span>
        <span class="text-[11px] text-muted-foreground/60">
          {{ relativeTime(novel.updatedAt) }}
        </span>
      </div>
    </div>
  </div>
</template>
