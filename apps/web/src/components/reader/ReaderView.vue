<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import DOMPurify from 'dompurify'
import type { ReaderSettings } from './types'

const props = defineProps<{
  content: string
  title: string
  chapterIndex: number
  totalChapters: number
  settings: ReaderSettings
}>()

const renderedContent = computed(() => {
  const html = props.content
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return DOMPurify.sanitize(html)
})

const emit = defineEmits<{
  prevChapter: []
  nextChapter: []
  showControls: []
  updateProgress: [scrollPercent: number]
}>()

const container = ref<HTMLElement>()
const scrollPercent = ref(0)

const readerStyle = computed(() => ({
  '--reader-font': props.settings.fontFamily,
  '--reader-font-size': `${props.settings.fontSize}px`,
  '--reader-line-height': props.settings.lineHeight,
  '--reader-paragraph-spacing': `${props.settings.paragraphSpacing}em`,
}))

const progressPercent = computed(() =>
  Math.round(scrollPercent.value * 100),
)

function onScroll() {
  if (!container.value) return
  const { scrollTop, scrollHeight, clientHeight } = container.value
  scrollPercent.value = scrollTop / (scrollHeight - clientHeight) || 0
  emit('updateProgress', scrollPercent.value)
}

function onPointerDown(e: PointerEvent) {
  const yFromBottom = window.innerHeight - e.clientY
  if (yFromBottom < 60) {
    emit('showControls')
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!container.value?.offsetParent) return
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    emit('prevChapter')
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    emit('nextChapter')
  }
}

function scrollToPos(pos: number) {
  if (!container.value) return
  container.value.scrollTo({ top: pos, behavior: 'instant' })
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

defineExpose({ scrollToPos })
</script>

<template>
  <div
    ref="container"
    class="reader h-full overflow-y-auto overscroll-none bg-background/65 text-foreground"
    :style="readerStyle"
    @scroll="onScroll"
    @pointerdown="onPointerDown"
  >
    <!-- Reading progress bar -->
    <div class="sticky top-0 z-20 h-0.5 bg-muted/30">
      <div
        class="h-full transition-[width] duration-200 ease-out"
        :style="{ width: `${progressPercent}%`, backgroundColor: 'var(--primary)' }"
      />
    </div>

    <!-- Content column -->
    <div class="w-full max-w-[680px] mx-auto px-5 sm:px-8">
      <!-- Chapter header -->
      <header class="pt-5 pb-2 text-center">
        <h2 class="text-xl font-bold leading-relaxed tracking-wide">
          {{ title }}
        </h2>
        <div class="flex items-center justify-center gap-3 mt-2">
          <div class="h-px flex-1 max-w-16 opacity-20" :style="{ backgroundColor: 'currentColor' }" />
          <span class="text-xs font-normal opacity-40 tracking-wider">
            {{ chapterIndex + 1 }} / {{ totalChapters }}
          </span>
          <div class="h-px flex-1 max-w-16 opacity-20" :style="{ backgroundColor: 'currentColor' }" />
        </div>
      </header>

      <!-- Chapter content -->
      <article
        class="article-content prose max-w-none pb-6"
        :style="{
          fontFamily: 'var(--reader-font)',
          fontSize: 'var(--reader-font-size)',
          lineHeight: 'var(--reader-line-height)',
        }"
        v-html="renderedContent"
      />

      <!-- Chapter navigation -->
      <nav class="flex items-center justify-between pb-8">
        <button
          v-if="chapterIndex > 0"
          class="text-sm opacity-50 hover:opacity-100 transition-opacity px-4 py-2.5 rounded-lg hover:bg-foreground/5"
          @click="emit('prevChapter')"
        >
          ← 上一章
        </button>
        <span class="flex-1" />
        <button
          v-if="chapterIndex < totalChapters - 1"
          class="text-sm opacity-50 hover:opacity-100 transition-opacity px-4 py-2.5 rounded-lg hover:bg-foreground/5"
          @click="emit('nextChapter')"
        >
          下一章 →
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.reader::-webkit-scrollbar {
  width: 5px;
}
.reader::-webkit-scrollbar-track {
  background: transparent;
}
.reader::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--foreground) 18%, transparent);
  border-radius: 3px;
}
.reader::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--foreground) 30%, transparent);
}

.article-content :deep(p) {
  text-indent: 2em;
  margin-bottom: var(--reader-paragraph-spacing) !important;
}
</style>
