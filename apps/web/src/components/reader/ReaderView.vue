<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ReaderSettings } from './types'

const props = defineProps<{
  content: string
  title: string
  chapterIndex: number
  totalChapters: number
  settings: ReaderSettings
}>()

const emit = defineEmits<{
  prevChapter: []
  nextChapter: []
  showControls: []
  updateProgress: [scrollPercent: number]
}>()

const container = ref<HTMLElement>()
const showTopBar = ref(false)
const scrollPercent = ref(0)

const readerStyle = computed(() => ({
  '--reader-font': props.settings.fontFamily,
  '--reader-font-size': `${props.settings.fontSize}px`,
  '--reader-line-height': props.settings.lineHeight,
  '--reader-paragraph-spacing': `${props.settings.paragraphSpacing}em`,
  '--reader-text': props.settings.textColor,
  '--reader-bg': props.settings.backgroundColor,
}))

function onScroll() {
  if (!container.value) return
  const { scrollTop, scrollHeight, clientHeight } = container.value
  scrollPercent.value = scrollTop / (scrollHeight - clientHeight) || 0
  emit('updateProgress', scrollPercent.value)
}

function onPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  const rect = target.getBoundingClientRect()
  const yFromBottom = rect.bottom - e.clientY
  if (yFromBottom < 60) {
    emit('showControls')
  }
}

function onKeydown(e: KeyboardEvent) {
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
    class="reader h-full overflow-y-auto select-none"
    :style="readerStyle"
    @scroll="onScroll"
    @pointerdown="onPointerDown"
  >
    <!-- Top bar: chapter info -->
    <div
      v-if="showTopBar"
      class="sticky top-0 z-10 py-2 px-4 text-center text-xs text-muted-foreground"
      style="background: var(--reader-bg)"
    >
      {{ title }} · {{ chapterIndex + 1 }}/{{ totalChapters }}
    </div>

    <!-- Chapter content -->
    <article class="px-4 py-8">
      <h2 class="text-xl font-bold mb-6 text-center">{{ title }}</h2>
      <div class="prose" v-html="content" />
    </article>

    <!-- Chapter navigation at bottom -->
    <div class="flex justify-between px-4 pb-8 pt-4 text-sm">
      <button
        v-if="chapterIndex > 0"
        class="text-muted-foreground hover:text-foreground"
        @click="emit('prevChapter')"
      >
        ← 上一章
      </button>
      <span class="flex-1" />
      <button
        v-if="chapterIndex < totalChapters - 1"
        class="text-muted-foreground hover:text-foreground"
        @click="emit('nextChapter')"
      >
        下一章 →
      </button>
    </div>
  </div>
</template>
