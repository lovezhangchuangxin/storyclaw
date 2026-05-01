<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PRESET_THEMES } from './types'
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
const scrollPercent = ref(0)

const accentColor = computed(() => {
  const theme = PRESET_THEMES.find(
    (t) => t.backgroundColor === props.settings.backgroundColor,
  )
  return theme?.accentColor ?? props.settings.textColor
})

const readerStyle = computed(() => ({
  '--reader-font': props.settings.fontFamily,
  '--reader-font-size': `${props.settings.fontSize}px`,
  '--reader-line-height': props.settings.lineHeight,
  '--reader-paragraph-spacing': `${props.settings.paragraphSpacing}em`,
  '--reader-text': props.settings.textColor,
  '--reader-bg': props.settings.backgroundColor,
  '--reader-accent': accentColor.value,
  fontFamily: props.settings.fontFamily,
  fontSize: `${props.settings.fontSize}px`,
  lineHeight: props.settings.lineHeight,
  color: props.settings.textColor,
  background: props.settings.backgroundColor,
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
    class="reader h-full overflow-y-auto"
    :style="readerStyle"
    @scroll="onScroll"
    @pointerdown="onPointerDown"
  >
    <!-- Reading progress bar -->
    <div class="sticky top-0 z-20 h-0.5 bg-muted/30">
      <div
        class="h-full transition-[width] duration-200 ease-out"
        :style="{ width: `${progressPercent}%`, backgroundColor: accentColor }"
      />
    </div>

    <!-- Content column -->
    <div class="w-full max-w-[680px] mx-auto px-5 sm:px-8">
      <!-- Chapter header -->
      <header class="pt-14 pb-4 text-center">
        <h2 class="text-2xl font-bold leading-relaxed tracking-wide">
          {{ title }}
        </h2>
        <div class="flex items-center justify-center gap-3 mt-4">
          <div class="h-px flex-1 max-w-16 opacity-20" :style="{ backgroundColor: 'currentColor' }" />
          <span class="text-xs font-normal opacity-40 tracking-wider">
            {{ chapterIndex + 1 }} / {{ totalChapters }}
          </span>
          <div class="h-px flex-1 max-w-16 opacity-20" :style="{ backgroundColor: 'currentColor' }" />
        </div>
      </header>

      <!-- Chapter content -->
      <article
        class="prose max-w-none pb-12"
        :style="{
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          color: 'inherit',
        }"
        v-html="content"
      />

      <!-- Chapter navigation -->
      <nav class="flex items-center justify-between pb-14">
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
